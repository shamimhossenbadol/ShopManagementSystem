import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, withTransaction } from '../../db/pool.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { round2 } from '../../utils/financial.js';
import { broadcastSessionEvent } from '../auth/auth.routes.js';

const openShiftSchema = z.object({
  openingBalance: z.coerce.number().min(0),
  openingCardBalance: z.coerce.number().min(0).optional().default(0),
  terminalName: z.string().optional().default('Terminal-01'),
  adjustments: z.array(z.object({
    amount: z.coerce.number(),
    description: z.string().min(1),
  })).optional().default([]),
});

const closeShiftSchema = z.object({
  actualClosingBalance: z.coerce.number().min(0),
  terminalCardTotal: z.coerce.number().min(0).default(0),
  closingNote: z.string().optional().nullable(),
  adjustments: z.array(z.object({
    amount: z.coerce.number(),
    description: z.string().min(1),
  })).optional().default([]),
});

/**
 * Calculates start and end timestamps for a given business date range
 * taking into account the configured shop_closing_hour (default "00:00").
 */
async function getBusinessRangeBounds(startDateStr?: string, endDateStr?: string) {
  const settingRes = await query(
    `SELECT setting_value FROM settings WHERE setting_key = 'shop_closing_hour'`
  );
  const closingHourStr = settingRes.rows[0]?.setting_value || '00:00';
  const [closeHour, closeMin] = closingHourStr.split(':').map((v: string) => parseInt(v, 10) || 0);

  const tzRes = await query(`SELECT setting_value FROM settings WHERE setting_key = 'timezone'`);
  const timeZone = tzRes.rows[0]?.setting_value || 'Asia/Riyadh';

  let todayDate: string;
  try {
    todayDate = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
  } catch {
    todayDate = new Date().toISOString().split('T')[0];
  }

  const startFormatted = startDateStr || todayDate;
  const endFormatted = endDateStr || startFormatted;

  const [sy, sm, sd] = startFormatted.split('-').map(Number);
  const startOfDay = new Date(Date.UTC(sy, sm - 1, sd, closeHour, closeMin, 0, 0));

  const [ey, em, ed] = endFormatted.split('-').map(Number);
  const startOfEndDay = new Date(Date.UTC(ey, em - 1, ed, closeHour, closeMin, 0, 0));
  const endOfDay = new Date(startOfEndDay.getTime() + 24 * 60 * 60 * 1000);

  const isTodayIncluded = todayDate >= startFormatted && todayDate <= endFormatted;

  return {
    startDate: startFormatted,
    endDate: endFormatted,
    businessDate: startFormatted === endFormatted ? startFormatted : `${startFormatted} to ${endFormatted}`,
    closingHour: closingHourStr,
    timeZone,
    startTime: startOfDay.toISOString(),
    endTime: endOfDay.toISOString(),
    isTodayIncluded,
    todayDate,
  };
}

async function getBusinessDayBounds(dateStr?: string) {
  return getBusinessRangeBounds(dateStr, dateStr);
}

export async function cashRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/v1/cash/pos-status - Check POS occupancy (is someone currently using the POS?)
  fastify.get('/pos-status', async (request, reply) => {
    // Check for any globally open cash session
    const openRes = await query(
      `SELECT cs.*, u.full_name as user_name, u.username
       FROM cash_sessions cs
       JOIN users u ON u.id = cs.user_id
       WHERE cs.status = 'open'
       LIMIT 1`
    );

    if (openRes.rows.length > 0) {
      const session = openRes.rows[0];
      // Get sales count and total for this session
      const salesRes = await query(
        `SELECT COUNT(id) as sales_count, COALESCE(SUM(grand_total), 0) as total_sales
         FROM sales WHERE session_id = $1 AND sale_status = 'completed'`,
        [session.id]
      );

      // Operational cash flow & cash sales
      const movRes = await query(
        `SELECT 
          COALESCE(SUM(CASE WHEN type = 'cash_in' AND source != 'opening_float' THEN amount WHEN type = 'cash_out' THEN -amount ELSE 0 END), 0) as net_operational_flow,
          COALESCE(SUM(CASE WHEN source = 'sale' THEN amount ELSE 0 END), 0) as cash_sales
         FROM cash_movements WHERE session_id = $1`,
        [session.id]
      );

      // Card sales
      const cardRes = await query(
        `SELECT COALESCE(SUM(sp.amount), 0) as card_total
         FROM sale_payments sp
         JOIN payment_methods pm ON pm.id = sp.payment_method_id
         JOIN sales s ON s.id = sp.sale_id
         WHERE s.session_id = $1 AND pm.is_cash = FALSE AND s.sale_status = 'completed'`,
        [session.id]
      );

      const openingBal = Number(session.opening_balance || 0);
      const openingCardBal = Number(session.opening_card_balance || 0);
      const cashSales = Number(movRes.rows[0]?.cash_sales || 0);
      const cardSales = Number(cardRes.rows[0]?.card_total || 0);
      const liveExpected = round2(openingBal + Number(movRes.rows[0]?.net_operational_flow || 0));

      return reply.send({
        success: true,
        data: {
          status: 'occupied',
          activeSession: {
            id: session.id,
            sequenceNumber: session.sequence_number,
            userId: session.user_id,
            userName: session.user_name,
            username: session.username,
            openedAt: session.opened_at,
            openingBalance: openingBal,
            openingCardBalance: openingCardBal,
            salesCount: Number(salesRes.rows[0]?.sales_count || 0),
            totalSales: Number(salesRes.rows[0]?.total_sales || 0),
            cashSales,
            cardSales,
            liveExpectedCash: liveExpected,
          },
        },
      });
    }

    // POS is available - get last closed session for carry-forward info
    const lastRes = await query(
      `SELECT cs.*, u.full_name as user_name, u.username
       FROM cash_sessions cs
       JOIN users u ON u.id = cs.user_id
       WHERE cs.status = 'closed'
       ORDER BY cs.closed_at DESC LIMIT 1`
    );

    return reply.send({
      success: true,
      data: {
        status: 'available',
        lastSession: lastRes.rows.length > 0 ? {
          id: lastRes.rows[0].id,
          sequenceNumber: lastRes.rows[0].sequence_number,
          closedAt: lastRes.rows[0].closed_at,
          closedBy: lastRes.rows[0].user_name,
          closingBalance: Number(lastRes.rows[0].closing_balance || 0),
          terminalCardTotal: Number(lastRes.rows[0].terminal_card_total || 0),
          expectedBalance: Number(lastRes.rows[0].expected_balance || 0),
          difference: Number(lastRes.rows[0].difference || 0),
          closeType: lastRes.rows[0].close_type || 'normal',
        } : null,
      },
    });
  });

  // GET /api/v1/cash/carry-forward - Get expected carry-forward balance for next session
  fastify.get('/carry-forward', async (request, reply) => {
    const lastRes = await query(
      `SELECT cs.*, u.full_name as user_name, u.username
       FROM cash_sessions cs
       JOIN users u ON u.id = cs.user_id
       WHERE cs.status = 'closed'
       ORDER BY cs.closed_at DESC LIMIT 1`
    );

    if (lastRes.rows.length === 0) {
      return reply.send({
        success: true,
        data: {
          hasLastSession: false,
          isFirstSession: true,
          carryForwardBalance: 0,
          carryForwardCardBalance: 0,
        },
      });
    }

    const last = lastRes.rows[0];
    return reply.send({
      success: true,
      data: {
        hasLastSession: true,
        isFirstSession: false,
        lastSessionId: last.id,
        lastClosedBy: last.user_name,
        lastClosedByUsername: last.username,
        lastClosedAt: last.closed_at,
        carryForwardBalance: Number(last.closing_balance),
        carryForwardCardBalance: Number(last.terminal_card_total || 0),
        lastExpectedBalance: Number(last.expected_balance),
        lastDifference: Number(last.difference),
        lastCloseType: last.close_type || 'normal',
      },
    });
  });

  // GET /api/v1/cash/status - Active Shift Status for current user
  fastify.get('/status', async (request, reply) => {
    const res = await query(
      `SELECT cs.*, u.full_name as user_name, u.username
       FROM cash_sessions cs
       JOIN users u ON u.id = cs.user_id
       WHERE cs.user_id = $1 AND cs.status = 'open' 
       ORDER BY cs.opened_at DESC LIMIT 1`,
      [request.user!.id]
    );

    if (res.rows.length === 0) {
      return reply.send({ success: true, data: { hasActiveShift: false, session: null } });
    }

    const session = res.rows[0];

    // Compute live expected cash (excluding opening_float to avoid double-counting)
    const movRes = await query(
      `SELECT 
        COALESCE(SUM(CASE WHEN type = 'cash_in' AND source != 'opening_float' THEN amount WHEN type = 'cash_out' THEN -amount ELSE 0 END), 0) as net_operational_flow,
        COALESCE(SUM(CASE WHEN source = 'sale' THEN amount ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN source = 'refund' THEN amount ELSE 0 END), 0) as cash_refunds,
        COALESCE(SUM(CASE WHEN source = 'expense' THEN amount ELSE 0 END), 0) as cash_expenses,
        COUNT(id) as total_movements
       FROM cash_movements WHERE session_id = $1`,
      [session.id]
    );

    // Compute live card/mada sales during this shift strictly by session_id
    const cardRes = await query(
      `SELECT COALESCE(SUM(sp.amount), 0) as card_total
       FROM sale_payments sp
       JOIN payment_methods pm ON pm.id = sp.payment_method_id
       JOIN sales s ON s.id = sp.sale_id
       WHERE s.session_id = $1 AND pm.is_cash = FALSE AND s.sale_status = 'completed'`,
      [session.id]
    );

    const openingFloat = Number(session.opening_balance || 0);
    const openingCardFloat = Number(session.opening_card_balance || 0);
    const netFlow = Number(movRes.rows[0]?.net_operational_flow || 0);
    const liveExpected = round2(openingFloat + netFlow);
    const liveCardSales = round2(Number(cardRes.rows[0]?.card_total || 0));
    const liveCardTotal = round2(openingCardFloat + liveCardSales);

    return reply.send({
      success: true,
      data: {
        hasActiveShift: true,
        session,
        liveExpectedCash: liveExpected,
        liveCardTotal: liveCardTotal,
        cardSalesTotal: liveCardSales,
        totalMovements: Number(movRes.rows[0]?.total_movements || 0),
      },
    });
  });

  // GET /api/v1/cash/session-summary - Comprehensive live session summary for cashier logout / X-Report
  fastify.get('/session-summary', async (request, reply) => {
    const res = await query(
      `SELECT * FROM cash_sessions 
       WHERE user_id = $1 AND status = 'open' 
       ORDER BY opened_at DESC LIMIT 1`,
      [request.user!.id]
    );

    if (res.rows.length === 0) {
      return reply.send({
        success: true,
        data: {
          hasActiveShift: false,
          session: null,
          cashier: {
            id: request.user!.id,
            username: request.user!.username,
            fullName: request.user!.fullName,
            role: request.user!.role,
          },
        },
      });
    }

    const session = res.rows[0];

    // Total sales completed strictly during this session
    const salesRes = await query(
      `SELECT 
        COUNT(id) as invoices_count,
        COALESCE(SUM(grand_total), 0) as total_gross_sales,
        COALESCE(SUM(total_tax), 0) as total_tax_collected
       FROM sales
       WHERE session_id = $1 AND sale_status = 'completed'`,
      [session.id]
    );

    // Cash movements breakdown
    const movRes = await query(
      `SELECT 
        COALESCE(SUM(CASE WHEN source = 'sale' THEN amount ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN source = 'refund' THEN amount ELSE 0 END), 0) as cash_refunds,
        COALESCE(SUM(CASE WHEN source = 'expense' THEN amount ELSE 0 END), 0) as cash_expenses,
        COALESCE(SUM(CASE WHEN type = 'cash_in' AND source != 'opening_float' THEN amount WHEN type = 'cash_out' THEN -amount ELSE 0 END), 0) as net_operational_flow
       FROM cash_movements WHERE session_id = $1`,
      [session.id]
    );

    // Card / Mada payments during shift strictly by session_id
    const cardRes = await query(
      `SELECT COALESCE(SUM(sp.amount), 0) as card_total
       FROM sale_payments sp
       JOIN payment_methods pm ON pm.id = sp.payment_method_id
       JOIN sales s ON s.id = sp.sale_id
       WHERE s.session_id = $1 AND pm.is_cash = FALSE AND s.sale_status = 'completed'`,
      [session.id]
    );

    const openingFloat = Number(session.opening_balance || 0);
    const openingCardFloat = Number(session.opening_card_balance || 0);
    const cashSales = Number(movRes.rows[0]?.cash_sales || 0);
    const cashRefunds = Number(movRes.rows[0]?.cash_refunds || 0);
    const cashExpenses = Number(movRes.rows[0]?.cash_expenses || 0);
    const cardSales = Number(cardRes.rows[0]?.card_total || 0);
    const invoicesCount = Number(salesRes.rows[0]?.invoices_count || 0);
    const totalGrossSales = Number(salesRes.rows[0]?.total_gross_sales || (cashSales + cardSales));
    const netOperationalFlow = Number(movRes.rows[0]?.net_operational_flow || 0);
    const expectedCashInDrawer = round2(openingFloat + netOperationalFlow);
    const expectedCardInTerminal = round2(openingCardFloat + cardSales);

    return reply.send({
      success: true,
      data: {
        hasActiveShift: true,
        session: {
          id: session.id,
          opened_at: session.opened_at,
          opening_balance: openingFloat,
          opening_card_balance: openingCardFloat,
          carry_forward_balance: Number(session.carry_forward_balance || 0),
          carry_forward_card_balance: Number(session.carry_forward_card_balance || 0),
          terminal_name: session.terminal_name || 'Terminal-01',
        },
        cashier: {
          id: request.user!.id,
          username: request.user!.username,
          fullName: request.user!.fullName,
          role: request.user!.role,
        },
        invoicesCount,
        totalGrossSales,
        cashSales,
        cardSales,
        cashRefunds,
        cashExpenses,
        expectedCashInDrawer,
        expectedCardInTerminal,
      },
    });
  });

  // POST /api/v1/cash/open - Open Cash Drawer Shift (Single POS with Sequential Carry-Forward)
  fastify.post('/open', async (request, reply) => {
    const parsed = openShiftSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: 'Invalid opening float.', errors: parsed.error.format() });
    }

    const { openingBalance, openingCardBalance, terminalName, adjustments } = parsed.data;

    // If this user already has an active open shift, gracefully resume it
    const existing = await query(
      `SELECT * FROM cash_sessions 
       WHERE user_id = $1 AND status = 'open' 
       ORDER BY opened_at DESC LIMIT 1`,
      [request.user!.id]
    );
    if (existing.rows.length > 0) {
      return reply.status(200).send({
        success: true,
        message: 'Resuming active shift session.',
        data: existing.rows[0],
      });
    }

    // Check if another user has an open session (POS is occupied)
    const occupiedRes = await query(
      `SELECT cs.*, u.full_name as user_name FROM cash_sessions cs
       JOIN users u ON u.id = cs.user_id
       WHERE cs.status = 'open' LIMIT 1`
    );
    if (occupiedRes.rows.length > 0) {
      return reply.status(409).send({
        success: false,
        code: 'POS_OCCUPIED',
        message: `POS is currently in use by ${occupiedRes.rows[0].user_name}. Force takeover required.`,
      });
    }

    try {
      const res = await withTransaction(async (client) => {
        // Get last closed session for carry-forward and sequence
        const lastRes = await client.query(
          `SELECT id, closing_balance, terminal_card_total, sequence_number FROM cash_sessions
           WHERE status = 'closed' ORDER BY closed_at DESC LIMIT 1`
        );

        const previousSessionId = lastRes.rows[0]?.id || null;
        const carryForwardBalance = lastRes.rows[0] ? Number(lastRes.rows[0].closing_balance) : 0;
        const carryForwardCardBalance = lastRes.rows[0] ? Number(lastRes.rows[0].terminal_card_total || 0) : 0;
        const nextSequence = (lastRes.rows[0]?.sequence_number || 0) + 1;

        const s = await client.query(
          `INSERT INTO cash_sessions 
           (user_id, status, opening_balance, expected_balance, terminal_name, 
            sequence_number, previous_session_id, carry_forward_balance, close_type,
            opening_card_balance, carry_forward_card_balance)
           VALUES ($1, 'open', $2, $2, $3, $4, $5, $6, 'normal', $7, $8) RETURNING *`,
          [request.user!.id, openingBalance, terminalName || 'Terminal-01', 
           nextSequence, previousSessionId, carryForwardBalance,
           openingCardBalance, carryForwardCardBalance]
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

        // Record opening adjustments (discrepancy explanations)
        if (adjustments && adjustments.length > 0) {
          for (const adj of adjustments) {
            await client.query(
              `INSERT INTO session_adjustments (session_id, adjustment_type, amount, description, created_by)
               VALUES ($1, 'opening', $2, $3, $4)`,
              [session.id, adj.amount, adj.description, request.user!.id]
            );
          }
        }

        await client.query(
          `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
           VALUES ($1, 'CASH_SHIFT_OPENED', 'cash_sessions', $2, $3)`,
          [request.user!.id, session.id, JSON.stringify({ 
            openingFloat: openingBalance,
            openingCardBalance,
            terminalName: terminalName || 'Terminal-01',
            sequenceNumber: nextSequence,
            previousSessionId,
            carryForwardBalance,
            carryForwardCardBalance,
            openingAdjustments: adjustments || [],
          })]
        );

        return session;
      });

      return reply.status(201).send({
        success: true,
        message: 'Cash shift opened successfully.',
        data: res,
      });
    } catch (err: any) {
      // Handle unique constraint violation (another session was opened concurrently)
      if (err.code === '23505' && err.constraint?.includes('uq_single_open_cash_session')) {
        return reply.status(409).send({
          success: false,
          code: 'POS_OCCUPIED',
          message: 'Another cashier just opened a session. Only one POS session can be active at a time.',
        });
      }
      return reply.status(400).send({ success: false, message: err.message });
    }
  });

  // POST /api/v1/cash/close - Blind Count & Shift Closing with Discrepancy Adjustments (Z-Report)
  fastify.post('/close', async (request, reply) => {
    const parsed = closeShiftSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: 'Invalid closing cash count.' });
    }

    const { actualClosingBalance, terminalCardTotal, closingNote, adjustments } = parsed.data;

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

        // 1. Calculate Expected Cash from operational movements (excluding opening_float)
        const movRes = await client.query(
          `SELECT 
            COALESCE(SUM(CASE WHEN type = 'cash_in' AND source != 'opening_float' THEN amount WHEN type = 'cash_out' THEN -amount ELSE 0 END), 0) as net_operational_flow,
            COALESCE(SUM(CASE WHEN source = 'sale' THEN amount ELSE 0 END), 0) as cash_sales,
            COALESCE(SUM(CASE WHEN source = 'refund' THEN amount ELSE 0 END), 0) as cash_refunds,
            COALESCE(SUM(CASE WHEN source = 'expense' THEN amount ELSE 0 END), 0) as cash_expenses
           FROM cash_movements WHERE session_id = $1`,
          [session.id]
        );

        // 2. Calculate Expected Card / Mada Total during shift strictly by session_id
        const cardRes = await client.query(
          `SELECT COALESCE(SUM(sp.amount), 0) as card_total
           FROM sale_payments sp
           JOIN payment_methods pm ON pm.id = sp.payment_method_id
           JOIN sales s ON s.id = sp.sale_id
           WHERE s.session_id = $1 AND pm.is_cash = FALSE AND s.sale_status = 'completed'`,
          [session.id]
        );

        const netFlow = Number(movRes.rows[0]?.net_operational_flow || 0);
        const expectedBalance = round2(Number(session.opening_balance) + netFlow);
        const difference = round2(actualClosingBalance - expectedBalance);

        const openingCardFloat = Number(session.opening_card_balance || 0);
        const expectedCard = round2(openingCardFloat + Number(cardRes.rows[0]?.card_total || 0));
        const cardDifference = round2(terminalCardTotal - expectedCard);

        // 3. Update session record with close_type
        const updated = await client.query(
          `UPDATE cash_sessions 
           SET status = 'closed', closed_at = NOW(), closing_balance = $1,
               expected_balance = $2, difference = $3,
               terminal_card_total = $4, terminal_card_expected = $5, terminal_card_discrepancy = $6,
               closing_note = $7, close_type = 'normal'
           WHERE id = $8 RETURNING *`,
          [actualClosingBalance, expectedBalance, difference, terminalCardTotal, expectedCard, cardDifference, closingNote || null, session.id]
        );

        // 4. Record closing adjustments (discrepancy explanations)
        if (adjustments && adjustments.length > 0) {
          for (const adj of adjustments) {
            await client.query(
              `INSERT INTO session_adjustments (session_id, adjustment_type, amount, description, created_by)
               VALUES ($1, 'closing', $2, $3, $4)`,
              [session.id, adj.amount, adj.description, request.user!.id]
            );
          }
        }

        // 5. Insert audit log
        await client.query(
          `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
           VALUES ($1, 'CASH_SHIFT_CLOSED', 'cash_sessions', $2, $3)`,
          [
            request.user!.id,
            session.id,
            JSON.stringify({
              terminalName: session.terminal_name,
              expectedCash: expectedBalance,
              actualCash: actualClosingBalance,
              cashDiff: difference,
              expectedCard,
              actualCard: terminalCardTotal,
              cardDiff: cardDifference,
              status: difference === 0 ? 'BALANCED' : difference > 0 ? 'OVERAGE' : 'SHORTAGE',
              closingAdjustments: adjustments || [],
            }),
          ]
        );

        // Invalidate cashier's POS session upon closing shift
        await client.query(
          `UPDATE users SET current_pos_session_id = NULL WHERE id = $1`,
          [request.user!.id]
        );
        broadcastSessionEvent(request.user!.id, 'SESSION_TERMINATED', undefined, 'pos');

        return {
          session: updated.rows[0],
          zReport: {
            shiftId: session.id,
            sequenceNumber: session.sequence_number,
            terminalName: session.terminal_name || 'Terminal-01',
            cashierName: request.user!.fullName,
            openedAt: session.opened_at,
            closedAt: new Date().toISOString(),
            openingFloat: Number(session.opening_balance),
            openingCardFloat: Number(session.opening_card_balance || 0),
            carryForwardBalance: Number(session.carry_forward_balance || 0),
            carryForwardCardBalance: Number(session.carry_forward_card_balance || 0),
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

  // POST /api/v1/cash/force-takeover - Force close current POS operator and take over
  fastify.post('/force-takeover', async (request, reply) => {
    const { reason } = (request.body as { reason?: string }) || {};

    try {
      const result = await withTransaction(async (client) => {
        // Find the currently open session
        const openRes = await client.query(
          `SELECT cs.*, u.full_name as user_name, u.username
           FROM cash_sessions cs
           JOIN users u ON u.id = cs.user_id
           WHERE cs.status = 'open'
           FOR UPDATE OF cs
           LIMIT 1`
        );

        if (openRes.rows.length === 0) {
          throw new Error('No active POS session to take over. The POS is available.');
        }

        const currentSession = openRes.rows[0];
        const displacedUserId = currentSession.user_id;

        // Calculate expected balance for the session being force-closed (excluding opening_float)
        const movRes = await client.query(
          `SELECT COALESCE(SUM(CASE WHEN type = 'cash_in' AND source != 'opening_float' THEN amount WHEN type = 'cash_out' THEN -amount ELSE 0 END), 0) as net_operational_flow
           FROM cash_movements WHERE session_id = $1`,
          [currentSession.id]
        );

        const netFlow = Number(movRes.rows[0]?.net_operational_flow || 0);
        const expectedBalance = round2(Number(currentSession.opening_balance) + netFlow);

        // Force-close the current session
        await client.query(
          `UPDATE cash_sessions 
           SET status = 'closed', closed_at = NOW(), 
               closing_balance = $1, expected_balance = $1, difference = 0,
               close_type = 'takeover', force_closed_by = $2,
               force_close_reason = $3,
               closing_note = $4
           WHERE id = $5`,
          [
            expectedBalance,
            request.user!.id,
            reason || null,
            `Force-closed: Takeover by ${request.user!.fullName} (@${request.user!.username})`,
            currentSession.id,
          ]
        );

        // Invalidate ONLY the displaced cashier's POS session (never touch manager dashboard sessions!)
        await client.query(
          `UPDATE users SET current_pos_session_id = NULL WHERE id = $1`,
          [displacedUserId]
        );

        // Audit log for the force takeover
        await client.query(
          `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
           VALUES ($1, 'CASH_SESSION_FORCE_TAKEOVER', 'cash_sessions', $2, $3)`,
          [
            request.user!.id,
            currentSession.id,
            JSON.stringify({
              displacedUser: currentSession.user_name,
              displacedUserId,
              takenOverBy: request.user!.fullName,
              expectedBalance,
              reason: reason || 'No reason provided',
              timestamp: new Date().toISOString(),
            }),
          ]
        );

        return {
          displacedUserId,
          displacedUserName: currentSession.user_name,
          closedSessionId: currentSession.id,
          carryForwardBalance: expectedBalance,
        };
      });

      // Broadcast session termination to the displaced cashier's POS terminal ONLY
      broadcastSessionEvent(result.displacedUserId, 'SESSION_SUPERSEDED', undefined, 'pos');

      return reply.send({
        success: true,
        message: `POS taken over from ${result.displacedUserName}. Their session has been force-closed.`,
        data: {
          previousSessionId: result.closedSessionId,
          carryForwardBalance: result.carryForwardBalance,
          displacedUser: result.displacedUserName,
        },
      });
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message });
    }
  });

  // GET /api/v1/cash/daily-summary - Daily Consolidated Business Day Cash Matrix & Staff Records
  fastify.get('/daily-summary', async (request, reply) => {
    const { date, startDate, endDate } = request.query as { date?: string; startDate?: string; endDate?: string };
    const effectiveStart = startDate || date;
    const effectiveEnd = endDate || date || effectiveStart;
    const bounds = await getBusinessRangeBounds(effectiveStart, effectiveEnd);

    // 1. Get all sessions for this business day/range (and any active open shifts if checking today/range includes today)
    const isToday = bounds.isTodayIncluded;
    const sessRes = await query(
      `SELECT cs.*, u.full_name as user_name, u.username, u.role as user_role
       FROM cash_sessions cs
       JOIN users u ON u.id = cs.user_id
       WHERE (cs.opened_at >= $1 AND cs.opened_at < $2)
          OR ($3::boolean = TRUE AND cs.status = 'open' AND cs.opened_at >= ($1::timestamptz - interval '36 hours'))
       ORDER BY cs.opened_at ASC`,
      [bounds.startTime, bounds.endTime, isToday]
    );

    // 2. Aggregate sales payments in this business day window
    const salesRes = await query(
      `SELECT 
        COUNT(s.id) as total_invoices,
        COALESCE(SUM(s.grand_total), 0) as total_gross_sales,
        COALESCE(SUM(s.total_tax), 0) as total_tax_collected
       FROM sales s
       WHERE s.created_at >= $1 AND s.created_at < $2 AND s.sale_status = 'completed'`,
      [bounds.startTime, bounds.endTime]
    );

    // 3. Cash & Card payments breakdown in this business day window
    const paymentsRes = await query(
      `SELECT 
        COALESCE(SUM(CASE WHEN pm.is_cash = TRUE THEN sp.amount ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN pm.is_cash = FALSE THEN sp.amount ELSE 0 END), 0) as card_sales
       FROM sale_payments sp
       JOIN payment_methods pm ON pm.id = sp.payment_method_id
       JOIN sales s ON s.id = sp.sale_id
       WHERE sp.created_at >= $1 AND sp.created_at < $2 AND s.sale_status = 'completed'`,
      [bounds.startTime, bounds.endTime]
    );

    // 4. Cash refunds in this business day window
    const returnsRes = await query(
      `SELECT COALESCE(SUM(total_amount), 0) as cash_refunds
       FROM sales_returns
       WHERE created_at >= $1 AND created_at < $2`,
      [bounds.startTime, bounds.endTime]
    );

    // 5. Operating expenses / drawer cash outs in this business day window
    const expRes = await query(
      `SELECT COALESCE(SUM(amount), 0) as cash_expenses
       FROM expenses
       WHERE created_at >= $1 AND created_at < $2`,
      [bounds.startTime, bounds.endTime]
    );

    // 6. Enrich each session with shift-specific metrics
    const staffSessions = [];
    let totalOpeningFloat = 0;
    let totalOpeningCardFloat = 0;
    let totalExpectedCashInDrawers = 0;
    let totalCountedCash = 0;
    let totalDiscrepancy = 0;

    for (const sess of sessRes.rows) {
      const openFloat = Number(sess.opening_balance || 0);
      const openCardFloat = Number(sess.opening_card_balance || 0);
      totalOpeningFloat += openFloat;
      totalOpeningCardFloat += openCardFloat;

      const movRes = await query(
        `SELECT 
          COALESCE(SUM(CASE WHEN type = 'cash_in' AND source != 'opening_float' THEN amount WHEN type = 'cash_out' THEN -amount ELSE 0 END), 0) as net_operational_flow,
          COALESCE(SUM(CASE WHEN source = 'sale' THEN amount ELSE 0 END), 0) as cash_sales,
          COALESCE(SUM(CASE WHEN source = 'refund' THEN amount ELSE 0 END), 0) as cash_refunds,
          COALESCE(SUM(CASE WHEN source = 'expense' THEN amount ELSE 0 END), 0) as cash_expenses
         FROM cash_movements WHERE session_id = $1`,
        [sess.id]
      );

      const cardRes = await query(
        `SELECT COALESCE(SUM(sp.amount), 0) as card_total
         FROM sale_payments sp
         JOIN payment_methods pm ON pm.id = sp.payment_method_id
         JOIN sales s ON s.id = sp.sale_id
         WHERE pm.is_cash = FALSE
           AND s.sale_status = 'completed'
           AND (s.session_id = $1 OR (s.session_id IS NULL AND sp.created_by = $2 AND s.created_at >= $3 AND (s.created_at <= $4 OR $4 IS NULL)))`,
        [sess.id, sess.user_id, sess.opened_at, sess.closed_at]
      );

      const sessSalesRes = await query(
        `SELECT COUNT(id) as invoices_count, COALESCE(SUM(grand_total), 0) as gross_sales
         FROM sales s
         WHERE s.sale_status = 'completed'
           AND (s.session_id = $1 OR (s.session_id IS NULL AND s.user_id = $2 AND s.created_at >= $3 AND (s.created_at <= $4 OR $4 IS NULL)))`,
        [sess.id, sess.user_id, sess.opened_at, sess.closed_at]
      );

      const sessCashSales = Number(movRes.rows[0]?.cash_sales || 0);
      const sessCardSales = Number(cardRes.rows[0]?.card_total || 0);
      const sessCashRefunds = Number(movRes.rows[0]?.cash_refunds || 0);
      const sessCashExpenses = Number(movRes.rows[0]?.cash_expenses || 0);
      const netFlow = Number(movRes.rows[0]?.net_operational_flow || 0);
      const expectedCash = round2(openFloat + netFlow);
      const countedCash = Number(sess.closing_balance || 0);
      const diff = sess.status === 'closed' ? round2(Number(sess.difference || (countedCash - expectedCash))) : 0;

      totalExpectedCashInDrawers += expectedCash;
      if (sess.status === 'closed') {
        totalCountedCash += countedCash;
        totalDiscrepancy += diff;
      }

      staffSessions.push({
        id: sess.id,
        sequenceNumber: sess.sequence_number,
        terminalName: sess.terminal_name || 'Terminal-01',
        userId: sess.user_id,
        userName: sess.user_name,
        username: sess.username,
        userRole: sess.user_role,
        status: sess.status,
        openedAt: sess.opened_at,
        closedAt: sess.closed_at,
        openingFloat: openFloat,
        openingCardFloat: openCardFloat,
        invoicesCount: Number(sessSalesRes.rows[0]?.invoices_count || 0),
        grossSales: Number(sessSalesRes.rows[0]?.gross_sales || 0),
        cashSales: sessCashSales,
        cardSales: sessCardSales,
        cashRefunds: sessCashRefunds,
        cashExpenses: sessCashExpenses,
        expectedCash: expectedCash,
        countedCash: countedCash,
        difference: diff,
        terminalCardTotal: Number(sess.terminal_card_total || 0),
        terminalCardExpected: sessCardSales,
        terminalCardDiscrepancy: Number(sess.terminal_card_discrepancy || 0),
        closingNote: sess.closing_note,
      });
    }

    const totalCashSales = Number(paymentsRes.rows[0]?.cash_sales || 0);
    const totalCardSales = Number(paymentsRes.rows[0]?.card_sales || 0);
    const totalCashRefunds = Number(returnsRes.rows[0]?.cash_refunds || 0);
    const totalCashExpenses = Number(expRes.rows[0]?.cash_expenses || 0);
    const totalGrossSales = Number(salesRes.rows[0]?.total_gross_sales || (totalCashSales + totalCardSales));
    const totalInvoices = Number(salesRes.rows[0]?.total_invoices || 0);
    const totalTaxCollected = Number(salesRes.rows[0]?.total_tax_collected || 0);

    // Net expected cash across all store drawers
    const netStoreExpectedCash = round2(totalOpeningFloat + totalCashSales - totalCashRefunds - totalCashExpenses);

    return reply.send({
      success: true,
      data: {
        businessDate: bounds.businessDate,
        startDate: bounds.startDate,
        endDate: bounds.endDate,
        closingHour: bounds.closingHour,
        startTime: bounds.startTime,
        endTime: bounds.endTime,
        isRange: bounds.startDate !== bounds.endDate,
        totals: {
          totalOpeningFloat: round2(totalOpeningFloat),
          totalOpeningCardFloat: round2(totalOpeningCardFloat),
          totalInvoices,
          totalGrossSales: round2(totalGrossSales),
          totalTaxCollected: round2(totalTaxCollected),
          totalCashSales: round2(totalCashSales),
          totalCardSales: round2(totalCardSales),
          totalCashRefunds: round2(totalCashRefunds),
          totalCashExpenses: round2(totalCashExpenses),
          expectedCashInDrawers: netStoreExpectedCash,
          totalCountedCash: round2(totalCountedCash),
          totalDiscrepancy: round2(totalDiscrepancy),
          activeDrawersCount: staffSessions.filter((s) => s.status === 'open').length,
          closedDrawersCount: staffSessions.filter((s) => s.status === 'closed').length,
        },
        staffSessions,
      },
    });
  });

  // GET /api/v1/cash/sessions - History of shifts with full financial metrics (Manager only)
  fastify.get('/sessions', { preHandler: [requireRole(['manager'])] }, async (request, reply) => {
    const { status, userId, startDate, endDate, limit = 100, offset = 0 } = request.query as {
      status?: string;
      userId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    };

    const conditions: string[] = [];
    const params: any[] = [];

    if (status === 'open') {
      params.push('open');
      conditions.push(`cs.status = $${params.length}`);
    } else if (status === 'closed') {
      params.push('closed');
      conditions.push(`cs.status = $${params.length}`);
    }

    if (userId && Number(userId) > 0) {
      params.push(Number(userId));
      conditions.push(`cs.user_id = $${params.length}`);
    }

    if (startDate || endDate) {
      const bounds = await getBusinessRangeBounds(startDate, endDate);
      params.push(bounds.startTime);
      const startParam = `$${params.length}`;
      params.push(bounds.endTime);
      const endParam = `$${params.length}`;
      params.push(bounds.isTodayIncluded);
      const todayParam = `$${params.length}`;
      conditions.push(
        `((cs.opened_at >= ${startParam} AND cs.opened_at < ${endParam}) OR (${todayParam}::boolean = TRUE AND cs.status = 'open' AND cs.opened_at >= (${startParam}::timestamptz - interval '36 hours')))`
      );
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(Math.min(Number(limit) || 100, 200));
    const limitParam = `$${params.length}`;
    params.push(Math.max(Number(offset) || 0, 0));
    const offsetParam = `$${params.length}`;

    const res = await query(
      `SELECT cs.*, u.full_name as user_name, u.username, u.role as user_role
       FROM cash_sessions cs
       JOIN users u ON u.id = cs.user_id
       ${whereClause}
       ORDER BY cs.opened_at DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params
    );

    // Enrich each session with aggregated sales & cash flow
    const enriched = await Promise.all(
      res.rows.map(async (sess: any) => {
        const openFloat = Number(sess.opening_balance || 0);

        const movRes = await query(
          `SELECT 
            COALESCE(SUM(CASE WHEN type = 'cash_in' AND source != 'opening_float' THEN amount WHEN type = 'cash_out' THEN -amount ELSE 0 END), 0) as net_operational_flow,
            COALESCE(SUM(CASE WHEN source = 'sale' THEN amount ELSE 0 END), 0) as cash_sales,
            COALESCE(SUM(CASE WHEN source = 'refund' THEN amount ELSE 0 END), 0) as cash_refunds,
            COALESCE(SUM(CASE WHEN source = 'expense' THEN amount ELSE 0 END), 0) as cash_expenses
           FROM cash_movements WHERE session_id = $1`,
          [sess.id]
        );

        const cardRes = await query(
          `SELECT COALESCE(SUM(sp.amount), 0) as card_total
           FROM sale_payments sp
           JOIN payment_methods pm ON pm.id = sp.payment_method_id
           JOIN sales s ON s.id = sp.sale_id
           WHERE pm.is_cash = FALSE
             AND s.sale_status = 'completed'
             AND (s.session_id = $1 OR (s.session_id IS NULL AND sp.created_by = $2 AND s.created_at >= $3 AND s.created_at <= COALESCE($4, $3 + interval '12 hours')))`,
          [sess.id, sess.user_id, sess.opened_at, sess.closed_at]
        );

        const salesRes = await query(
          `SELECT COUNT(id) as invoices_count, COALESCE(SUM(grand_total), 0) as gross_sales
           FROM sales s
           WHERE (s.session_id = $1 OR (s.session_id IS NULL AND s.user_id = $2 AND s.created_at >= $3 AND s.created_at <= COALESCE($4, $3 + interval '12 hours'))) AND s.sale_status = 'completed'`,
          [sess.id, sess.user_id, sess.opened_at, sess.closed_at]
        );

        const cashSales = Number(movRes.rows[0]?.cash_sales || 0);
        const cardSales = Number(cardRes.rows[0]?.card_total || 0);
        const cashRefunds = Number(movRes.rows[0]?.cash_refunds || 0);
        const cashExpenses = Number(movRes.rows[0]?.cash_expenses || 0);
        const netFlow = Number(movRes.rows[0]?.net_operational_flow || 0);
        const expectedCash = round2(openFloat + netFlow);
        const countedCash = Number(sess.closing_balance || 0);
        const diff = sess.status === 'closed' ? round2(Number(sess.difference ?? (countedCash - expectedCash))) : 0;

        return {
          id: sess.id,
          sequenceNumber: sess.sequence_number,
          terminalName: sess.terminal_name || 'Terminal-01',
          userId: sess.user_id,
          userName: sess.user_name,
          username: sess.username,
          userRole: sess.user_role,
          status: sess.status,
          openedAt: sess.opened_at,
          closedAt: sess.closed_at,
          openingFloat: openFloat,
          openingCardFloat: Number(sess.opening_card_balance || 0),
          carryForwardBalance: Number(sess.carry_forward_balance || 0),
          carryForwardCardBalance: Number(sess.carry_forward_card_balance || 0),
          invoicesCount: Number(salesRes.rows[0]?.invoices_count || 0),
          grossSales: Number(salesRes.rows[0]?.gross_sales || 0),
          cashSales,
          cardSales,
          cashRefunds,
          cashExpenses,
          expectedCash,
          countedCash,
          difference: diff,
          terminalCardTotal: Number(sess.terminal_card_total || 0),
          terminalCardExpected: cardSales,
          terminalCardDiscrepancy: Number(sess.terminal_card_discrepancy || 0),
          closingNote: sess.closing_note,
        };
      })
    );

    return reply.send({ success: true, data: enriched });
  });

  // GET /api/v1/cash/session-timeline - Manager chronological session timeline with adjustments
  fastify.get('/session-timeline', { preHandler: [requireRole(['manager'])] }, async (request, reply) => {
    const { page = 1, limit = 20, startDate, endDate, userId } = request.query as {
      page?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
      userId?: string;
    };

    const conditions: string[] = [];
    const params: any[] = [];

    if (startDate) {
      params.push(startDate);
      conditions.push(`cs.opened_at >= $${params.length}::date`);
    }
    if (endDate) {
      params.push(endDate);
      conditions.push(`cs.opened_at < ($${params.length}::date + interval '1 day')`);
    }
    if (userId && Number(userId) > 0) {
      params.push(Number(userId));
      conditions.push(`cs.user_id = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    params.push(limitNum);
    const limitParam = `$${params.length}`;
    params.push(offset);
    const offsetParam = `$${params.length}`;

    // Get total count
    const countRes = await query(
      `SELECT COUNT(*) as total FROM cash_sessions cs ${whereClause}`,
      params.slice(0, -2) // exclude limit and offset params
    );
    const total = Number(countRes.rows[0]?.total || 0);

    // Get sessions ordered chronologically (newest first)
    const sessRes = await query(
      `SELECT cs.*, u.full_name as user_name, u.username, u.role as user_role,
              fc.full_name as force_closed_by_name
       FROM cash_sessions cs
       JOIN users u ON u.id = cs.user_id
       LEFT JOIN users fc ON fc.id = cs.force_closed_by
       ${whereClause}
       ORDER BY cs.opened_at DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params
    );

    // Enrich each session
    const sessions = await Promise.all(
      sessRes.rows.map(async (sess: any) => {
        const openFloat = Number(sess.opening_balance || 0);

        // Cash movements summary (excluding opening_float)
        const movRes = await query(
          `SELECT 
            COALESCE(SUM(CASE WHEN type = 'cash_in' AND source != 'opening_float' THEN amount WHEN type = 'cash_out' THEN -amount ELSE 0 END), 0) as net_operational_flow,
            COALESCE(SUM(CASE WHEN source = 'sale' THEN amount ELSE 0 END), 0) as cash_sales,
            COALESCE(SUM(CASE WHEN source = 'refund' THEN amount ELSE 0 END), 0) as cash_refunds,
            COALESCE(SUM(CASE WHEN source = 'expense' THEN amount ELSE 0 END), 0) as cash_expenses
           FROM cash_movements WHERE session_id = $1`,
          [sess.id]
        );

        // Card payments
        const cardRes = await query(
          `SELECT COALESCE(SUM(sp.amount), 0) as card_total
           FROM sale_payments sp
           JOIN payment_methods pm ON pm.id = sp.payment_method_id
           JOIN sales s ON s.id = sp.sale_id
           WHERE s.session_id = $1 AND pm.is_cash = FALSE AND s.sale_status = 'completed'`,
          [sess.id]
        );

        // Sales count
        const salesRes = await query(
          `SELECT COUNT(id) as invoices_count, COALESCE(SUM(grand_total), 0) as gross_sales
           FROM sales WHERE session_id = $1 AND sale_status = 'completed'`,
          [sess.id]
        );

        // Session adjustments
        const adjRes = await query(
          `SELECT sa.*, u.full_name as created_by_name
           FROM session_adjustments sa
           JOIN users u ON u.id = sa.created_by
           WHERE sa.session_id = $1
           ORDER BY sa.created_at ASC`,
          [sess.id]
        );

        const openingAdjustments = adjRes.rows.filter((a: any) => a.adjustment_type === 'opening');
        const closingAdjustments = adjRes.rows.filter((a: any) => a.adjustment_type === 'closing');

        const cashSales = Number(movRes.rows[0]?.cash_sales || 0);
        const cardSales = Number(cardRes.rows[0]?.card_total || 0);
        const cashRefunds = Number(movRes.rows[0]?.cash_refunds || 0);
        const cashExpenses = Number(movRes.rows[0]?.cash_expenses || 0);
        const netFlow = Number(movRes.rows[0]?.net_operational_flow || 0);
        const expectedCash = round2(openFloat + netFlow);

        return {
          id: sess.id,
          sequenceNumber: sess.sequence_number,
          user: {
            id: sess.user_id,
            fullName: sess.user_name,
            username: sess.username,
            role: sess.user_role,
          },
          status: sess.status,
          openedAt: sess.opened_at,
          closedAt: sess.closed_at,
          terminalName: sess.terminal_name || 'Terminal-01',
          openingBalance: openFloat,
          openingCardBalance: Number(sess.opening_card_balance || 0),
          carryForwardBalance: Number(sess.carry_forward_balance || 0),
          carryForwardCardBalance: Number(sess.carry_forward_card_balance || 0),
          previousSessionId: sess.previous_session_id,
          salesCount: Number(salesRes.rows[0]?.invoices_count || 0),
          grossSales: Number(salesRes.rows[0]?.gross_sales || 0),
          cashSales,
          cardSales,
          cashRefunds,
          cashExpenses,
          expectedBalance: expectedCash,
          closingBalance: Number(sess.closing_balance || 0),
          difference: sess.status === 'closed' ? round2(Number(sess.difference ?? 0)) : 0,
          closeType: sess.close_type || 'normal',
          forceClosedBy: sess.force_closed_by_name || null,
          forceCloseReason: sess.force_close_reason || null,
          closingNote: sess.closing_note,
          terminalCardTotal: Number(sess.terminal_card_total || 0),
          terminalCardExpected: cardSales,
          terminalCardDiscrepancy: Number(sess.terminal_card_discrepancy || 0),
          openingAdjustments: openingAdjustments.map((a: any) => ({
            id: a.id,
            amount: Number(a.amount),
            description: a.description,
            createdBy: a.created_by_name,
            createdAt: a.created_at,
          })),
          closingAdjustments: closingAdjustments.map((a: any) => ({
            id: a.id,
            amount: Number(a.amount),
            description: a.description,
            createdBy: a.created_by_name,
            createdAt: a.created_at,
          })),
        };
      })
    );

    // Summary stats
    const summaryRes = await query(
      `SELECT 
        COUNT(*) as total_sessions,
        COALESCE(SUM(CASE WHEN status = 'closed' THEN difference ELSE 0 END), 0) as total_discrepancy
       FROM cash_sessions cs ${whereClause}`,
      params.slice(0, -2)
    );

    // Current cash in drawer
    const currentCashRes = await query(
      `SELECT closing_balance FROM cash_sessions WHERE status = 'closed' ORDER BY closed_at DESC LIMIT 1`
    );

    return reply.send({
      success: true,
      data: {
        sessions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
        summary: {
          totalSessions: total,
          totalDiscrepancy: round2(Number(summaryRes.rows[0]?.total_discrepancy || 0)),
          currentCashInDrawer: Number(currentCashRes.rows[0]?.closing_balance || 0),
        },
      },
    });
  });

  // POST /api/v1/cash/sessions/:id/force-close - Disabled: Manager cannot terminate POS session remotely
  fastify.post('/sessions/:id/force-close', { preHandler: [requireRole(['manager'])] }, async (request, reply) => {
    return reply.status(403).send({
      success: false,
      message: 'Manager force-close is disabled. POS sessions must be closed directly at the checkout counter.',
    });
  });

  // GET /api/v1/cash/sessions/:id - Shift detail with movements, adjustments, and dynamic invoice-level view
  fastify.get('/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const sessRes = await query(
      `SELECT cs.*, u.full_name as user_name, u.username, u.role as user_role,
              fc.full_name as force_closed_by_name
       FROM cash_sessions cs
       JOIN users u ON u.id = cs.user_id
       LEFT JOIN users fc ON fc.id = cs.force_closed_by
       WHERE cs.id = $1`,
      [Number(id)]
    );

    if (sessRes.rows.length === 0) return reply.status(404).send({ success: false, message: 'Session not found.' });

    const sess = sessRes.rows[0];

    const movRes = await query(
      `SELECT * FROM cash_movements WHERE session_id = $1 ORDER BY created_at ASC`,
      [Number(id)]
    );

    const adjRes = await query(
      `SELECT sa.*, u.full_name as created_by_name
       FROM session_adjustments sa
       JOIN users u ON u.id = sa.created_by
       WHERE sa.session_id = $1
       ORDER BY sa.created_at ASC`,
      [Number(id)]
    );

    // Invoices / sales for this session
    const salesRes = await query(
      `SELECT 
         s.id, s.reference_no, s.created_at, s.total_items, s.subtotal,
         s.total_discount, s.total_tax, s.grand_total, s.paid_amount, s.due_amount,
         s.payment_status, s.sale_status,
         COALESCE(i.invoice_no, s.reference_no) as invoice_no,
         COALESCE(c.name, 'Walk-in Customer') as customer_name,
         c.phone as customer_phone
       FROM sales s
       LEFT JOIN invoices i ON i.sale_id = s.id
       LEFT JOIN customers c ON c.id = s.customer_id
       WHERE (s.session_id = $1 OR (s.session_id IS NULL AND s.user_id = $2 AND s.created_at >= $3 AND (s.created_at <= $4 OR $4 IS NULL)))
         AND s.sale_status = 'completed'
       ORDER BY s.created_at DESC`,
      [Number(id), sess.user_id, sess.opened_at, sess.closed_at]
    );

    const saleIds = salesRes.rows.map((s: any) => s.id);
    const paymentsBySale: Record<number, any[]> = {};
    const itemsBySale: Record<number, any[]> = {};

    if (saleIds.length > 0) {
      const payRes = await query(
        `SELECT sp.sale_id, sp.amount, pm.name as method_name, pm.is_cash
         FROM sale_payments sp
         JOIN payment_methods pm ON pm.id = sp.payment_method_id
         WHERE sp.sale_id = ANY($1::int[])`,
        [saleIds]
      );
      for (const p of payRes.rows) {
        if (!paymentsBySale[p.sale_id]) paymentsBySale[p.sale_id] = [];
        paymentsBySale[p.sale_id].push({
          methodName: p.method_name,
          amount: Number(p.amount),
          isCash: p.is_cash,
        });
      }

      const itemsRes = await query(
        `SELECT si.sale_id, si.product_id, si.quantity, si.unit_price, si.tax_amount, si.subtotal,
                p.name as product_name, p.sku
         FROM sale_items si
         JOIN products p ON p.id = si.product_id
         WHERE si.sale_id = ANY($1::int[])
         ORDER BY si.id ASC`,
        [saleIds]
      );
      for (const item of itemsRes.rows) {
        if (!itemsBySale[item.sale_id]) itemsBySale[item.sale_id] = [];
        itemsBySale[item.sale_id].push({
          productId: item.product_id,
          productName: item.product_name,
          sku: item.sku,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unit_price),
          taxAmount: Number(item.tax_amount),
          subtotal: Number(item.subtotal),
        });
      }
    }

    const invoices = salesRes.rows.map((s: any) => ({
      id: s.id,
      invoiceNo: s.invoice_no,
      referenceNo: s.reference_no,
      createdAt: s.created_at,
      customerName: s.customer_name,
      customerPhone: s.customer_phone,
      totalItems: Number(s.total_items),
      subtotal: Number(s.subtotal),
      totalDiscount: Number(s.total_discount),
      totalTax: Number(s.total_tax),
      grandTotal: Number(s.grand_total),
      paidAmount: Number(s.paid_amount),
      paymentStatus: s.payment_status,
      payments: paymentsBySale[s.id] || [],
      items: itemsBySale[s.id] || [],
    }));

    // Calculate accurate aggregated financial metrics for both open and closed states
    const openFloat = Number(sess.opening_balance || 0);
    const openCardFloat = Number(sess.opening_card_balance || 0);

    let totalGrossSales = 0;
    let totalTaxCollected = 0;
    for (const inv of invoices) {
      totalGrossSales += inv.grandTotal;
      totalTaxCollected += inv.totalTax;
    }

    const payBreakdownRes = await query(
      `SELECT 
        COALESCE(SUM(CASE WHEN pm.is_cash = TRUE THEN sp.amount ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN pm.is_cash = FALSE THEN sp.amount ELSE 0 END), 0) as card_sales
       FROM sale_payments sp
       JOIN payment_methods pm ON pm.id = sp.payment_method_id
       JOIN sales s ON s.id = sp.sale_id
       WHERE pm.is_cash IS NOT NULL
         AND s.sale_status = 'completed'
         AND (s.session_id = $1 OR (s.session_id IS NULL AND sp.created_by = $2 AND s.created_at >= $3 AND (s.created_at <= $4 OR $4 IS NULL)))`,
      [Number(id), sess.user_id, sess.opened_at, sess.closed_at]
    );

    const movSummaryRes = await query(
      `SELECT 
        COALESCE(SUM(CASE WHEN type = 'cash_in' AND source != 'opening_float' THEN amount WHEN type = 'cash_out' THEN -amount ELSE 0 END), 0) as net_operational_flow,
        COALESCE(SUM(CASE WHEN source = 'refund' THEN amount ELSE 0 END), 0) as cash_refunds,
        COALESCE(SUM(CASE WHEN source = 'expense' THEN amount ELSE 0 END), 0) as cash_expenses,
        COALESCE(SUM(CASE WHEN type = 'cash_in' AND source NOT IN ('opening_float', 'sale') THEN amount ELSE 0 END), 0) as manual_cash_ins
       FROM cash_movements WHERE session_id = $1`,
      [Number(id)]
    );

    const cashSales = Number(payBreakdownRes.rows[0]?.cash_sales || 0);
    const cardSales = Number(payBreakdownRes.rows[0]?.card_sales || 0);
    const netOperationalFlow = Number(movSummaryRes.rows[0]?.net_operational_flow || 0);
    const cashRefunds = Number(movSummaryRes.rows[0]?.cash_refunds || 0);
    const cashExpenses = Number(movSummaryRes.rows[0]?.cash_expenses || 0);
    const manualCashIns = Number(movSummaryRes.rows[0]?.manual_cash_ins || 0);

    const isClosed = sess.status === 'closed';
    const expectedCash = isClosed ? Number(sess.expected_balance || 0) : round2(openFloat + netOperationalFlow);
    const countedCash = isClosed ? Number(sess.closing_balance || 0) : null;
    const cashDifference = isClosed ? round2(Number(sess.difference || 0)) : null;

    const expectedCard = isClosed 
      ? Number(sess.terminal_card_expected ?? round2(openCardFloat + cardSales))
      : round2(openCardFloat + cardSales);
    const countedCard = isClosed ? Number(sess.terminal_card_total || 0) : null;
    const cardDifference = isClosed ? round2(Number(sess.terminal_card_discrepancy || 0)) : null;

    return reply.send({
      success: true,
      data: {
        session: {
          ...sess,
          opening_balance: openFloat,
          opening_card_balance: openCardFloat,
          openingBalance: openFloat,
          openingCardBalance: openCardFloat,
          carryForwardBalance: Number(sess.carry_forward_balance || 0),
          carryForwardCardBalance: Number(sess.carry_forward_card_balance || 0),
          forceClosedByName: sess.force_closed_by_name,
          grossSales: round2(totalGrossSales),
          cashSales: round2(cashSales),
          cardSales: round2(cardSales),
          totalTaxCollected: round2(totalTaxCollected),
          invoicesCount: invoices.length,
          netOperationalFlow: round2(netOperationalFlow),
          cashRefunds: round2(cashRefunds),
          cashExpenses: round2(cashExpenses),
          manualCashIns: round2(manualCashIns),
          expected_balance: round2(expectedCash),
          expectedCash: round2(expectedCash),
          closing_balance: countedCash !== null ? countedCash : 0,
          countedCash,
          difference: cashDifference !== null ? cashDifference : 0,
          cashDifference,
          terminal_card_expected: round2(expectedCard),
          expectedCard: round2(expectedCard),
          terminal_card_total: countedCard !== null ? countedCard : 0,
          countedCard,
          terminal_card_discrepancy: cardDifference !== null ? cardDifference : 0,
          cardDifference,
        },
        movements: movRes.rows,
        adjustments: adjRes.rows.map((a: any) => ({
          id: a.id,
          adjustmentType: a.adjustment_type,
          amount: Number(a.amount),
          description: a.description,
          createdBy: a.created_by_name,
          createdAt: a.created_at,
        })),
        invoices,
      },
    });
  });
}
