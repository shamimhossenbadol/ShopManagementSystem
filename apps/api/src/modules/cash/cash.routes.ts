import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, withTransaction } from '../../db/pool.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { round2 } from '../../utils/financial.js';

const openShiftSchema = z.object({
  openingBalance: z.coerce.number().min(0),
});

const closeShiftSchema = z.object({
  actualClosingBalance: z.coerce.number().min(0),
  terminalCardTotal: z.coerce.number().min(0).default(0),
  closingNote: z.string().optional().nullable(),
});

export async function cashRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/v1/cash/status - Active Shift Status for current user
  fastify.get('/status', async (request, reply) => {
    const res = await query(
      `SELECT * FROM cash_sessions 
       WHERE user_id = $1 AND status = 'open' 
       ORDER BY opened_at DESC LIMIT 1`,
      [request.user!.id]
    );

    if (res.rows.length === 0) {
      return reply.send({ success: true, data: { hasActiveShift: false, session: null } });
    }

    const session = res.rows[0];

    // Compute live expected cash
    const movRes = await query(
      `SELECT 
        COALESCE(SUM(CASE WHEN type = 'cash_in' THEN amount ELSE -amount END), 0) as net_cash_flow,
        COUNT(id) as total_movements
       FROM cash_movements WHERE session_id = $1`,
      [session.id]
    );

    // Compute live card/mada sales during this shift
    const cardRes = await query(
      `SELECT COALESCE(SUM(sp.amount), 0) as card_total
       FROM sale_payments sp
       JOIN payment_methods pm ON pm.id = sp.payment_method_id
       JOIN sales s ON s.id = sp.sale_id
       WHERE sp.created_by = $1 AND pm.is_cash = FALSE AND s.created_at >= $2`,
      [request.user!.id, session.opened_at]
    );

    const netFlow = Number(movRes.rows[0]?.net_cash_flow || 0);
    const liveExpected = round2(Number(session.opening_balance) + netFlow);
    const liveCardTotal = round2(Number(cardRes.rows[0]?.card_total || 0));

    return reply.send({
      success: true,
      data: {
        hasActiveShift: true,
        session,
        liveExpectedCash: liveExpected,
        liveCardTotal: liveCardTotal,
        totalMovements: Number(movRes.rows[0]?.total_movements || 0),
      },
    });
  });

  // POST /api/v1/cash/open - Open Cash Drawer Shift
  fastify.post('/open', async (request, reply) => {
    const parsed = openShiftSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: 'Invalid opening float.' });
    }

    const { openingBalance } = parsed.data;

    // Check if session already open
    const existing = await query(
      `SELECT id FROM cash_sessions WHERE user_id = $1 AND status = 'open'`,
      [request.user!.id]
    );
    if (existing.rows.length > 0) {
      return reply.status(400).send({ success: false, message: 'You already have an active open shift.' });
    }

    const res = await withTransaction(async (client) => {
      const s = await client.query(
        `INSERT INTO cash_sessions (user_id, status, opening_balance, expected_balance)
         VALUES ($1, 'open', $2, $2) RETURNING *`,
        [request.user!.id, openingBalance]
      );
      const session = s.rows[0];

      // Initial opening float movement
      if (openingBalance > 0) {
        await client.query(
          `INSERT INTO cash_movements (session_id, type, amount, source, description)
           VALUES ($1, 'cash_in', $2, 'opening_float', 'Shift opening float')`,
          [session.id, openingBalance]
        );
      }

      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
         VALUES ($1, 'CASH_SHIFT_OPENED', 'cash_sessions', $2, $3)`,
        [request.user!.id, session.id, JSON.stringify({ openingFloat: openingBalance })]
      );

      return session;
    });

    return reply.status(201).send({
      success: true,
      message: 'Cash shift opened successfully.',
      data: res,
    });
  });

  // POST /api/v1/cash/close - Blind Count & Shift Closing (Z-Report with Mada Terminal Reconciliation)
  fastify.post('/close', async (request, reply) => {
    const parsed = closeShiftSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: 'Invalid closing cash count.' });
    }

    const { actualClosingBalance, terminalCardTotal, closingNote } = parsed.data;

    try {
      const result = await withTransaction(async (client) => {
        const sessRes = await client.query(
          `SELECT * FROM cash_sessions WHERE user_id = $1 AND status = 'open' FOR UPDATE`,
          [request.user!.id]
        );

        if (sessRes.rows.length === 0) {
          throw new Error('No active shift found to close.');
        }

        const session = sessRes.rows[0];

        // 1. Calculate Expected Cash
        const movRes = await client.query(
          `SELECT 
            COALESCE(SUM(CASE WHEN type = 'cash_in' THEN amount ELSE -amount END), 0) as net_cash_flow,
            COALESCE(SUM(CASE WHEN source = 'sale' THEN amount ELSE 0 END), 0) as cash_sales,
            COALESCE(SUM(CASE WHEN source = 'refund' THEN amount ELSE 0 END), 0) as cash_refunds,
            COALESCE(SUM(CASE WHEN source = 'expense' THEN amount ELSE 0 END), 0) as cash_expenses
           FROM cash_movements WHERE session_id = $1`,
          [session.id]
        );

        // 2. Calculate Expected Card / Mada Total during shift
        const cardRes = await client.query(
          `SELECT COALESCE(SUM(sp.amount), 0) as card_total
           FROM sale_payments sp
           JOIN payment_methods pm ON pm.id = sp.payment_method_id
           JOIN sales s ON s.id = sp.sale_id
           WHERE sp.created_by = $1 AND pm.is_cash = FALSE AND s.created_at >= $2`,
          [request.user!.id, session.opened_at]
        );

        const netFlow = Number(movRes.rows[0]?.net_cash_flow || 0);
        const expectedBalance = round2(Number(session.opening_balance) + netFlow);
        const difference = round2(actualClosingBalance - expectedBalance);

        const expectedCard = round2(Number(cardRes.rows[0]?.card_total || 0));
        const cardDifference = round2(terminalCardTotal - expectedCard);

        // 3. Update session record
        const updated = await client.query(
          `UPDATE cash_sessions 
           SET status = 'closed', closed_at = NOW(), closing_balance = $1,
               expected_balance = $2, difference = $3,
               terminal_card_total = $4, terminal_card_expected = $5, terminal_card_discrepancy = $6,
               closing_note = $7
           WHERE id = $8 RETURNING *`,
          [actualClosingBalance, expectedBalance, difference, terminalCardTotal, expectedCard, cardDifference, closingNote || null, session.id]
        );

        // 4. Insert audit log
        await client.query(
          `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
           VALUES ($1, 'CASH_SHIFT_CLOSED', 'cash_sessions', $2, $3)`,
          [
            request.user!.id,
            session.id,
            JSON.stringify({
              expectedCash: expectedBalance,
              actualCash: actualClosingBalance,
              cashDiff: difference,
              expectedCard,
              actualCard: terminalCardTotal,
              cardDiff: cardDifference,
              status: difference === 0 ? 'BALANCED' : difference > 0 ? 'OVERAGE' : 'SHORTAGE',
            }),
          ]
        );

        return {
          session: updated.rows[0],
          zReport: {
            shiftId: session.id,
            cashierName: request.user!.fullName,
            openedAt: session.opened_at,
            closedAt: new Date().toISOString(),
            openingFloat: Number(session.opening_balance),
            cashSales: Number(movRes.rows[0]?.cash_sales || 0),
            cashRefunds: Number(movRes.rows[0]?.cash_refunds || 0),
            cashExpenses: Number(movRes.rows[0]?.cash_expenses || 0),
            expectedCash: expectedBalance,
            actualCountedCash: actualClosingBalance,
            cashDifference: difference,
            expectedCard: expectedCard,
            terminalCardTotal: terminalCardTotal,
            cardDifference: cardDifference,
            status: difference === 0 && cardDifference === 0 ? 'BALANCED' : 'DISCREPANCY',
          },
        };
      });

      return reply.send({
        success: true,
        message: 'Shift closed successfully. Z-Report generated.',
        data: result,
      });
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message });
    }
  });

  // GET /api/v1/cash/sessions - History of shifts (Manager only)
  fastify.get('/sessions', { preHandler: [requireRole(['manager'])] }, async (request, reply) => {
    const res = await query(
      `SELECT cs.*, u.full_name as user_name, u.username
       FROM cash_sessions cs
       JOIN users u ON u.id = cs.user_id
       ORDER BY cs.opened_at DESC LIMIT 50`
    );
    return reply.send({ success: true, data: res.rows });
  });

  // GET /api/v1/cash/sessions/:id - Shift detail with movements breakdown
  fastify.get('/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const sessRes = await query(
      `SELECT cs.*, u.full_name as user_name 
       FROM cash_sessions cs
       JOIN users u ON u.id = cs.user_id
       WHERE cs.id = $1`,
      [Number(id)]
    );

    if (sessRes.rows.length === 0) return reply.status(404).send({ success: false, message: 'Session not found.' });

    const movRes = await query(
      `SELECT * FROM cash_movements WHERE session_id = $1 ORDER BY created_at ASC`,
      [Number(id)]
    );

    return reply.send({
      success: true,
      data: {
        session: sessRes.rows[0],
        movements: movRes.rows,
      },
    });
  });
}
