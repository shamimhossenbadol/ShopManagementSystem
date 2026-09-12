'use client';

import React from 'react';
import { ProductFormModal } from '@/components/products/ProductFormModal';

interface QuickAddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBarcode?: string;
  onProductCreated: (product: any, autoAddToCart?: boolean) => void;
}

export default function QuickAddProductModal({
  isOpen,
  onClose,
  initialBarcode = '',
  onProductCreated,
}: QuickAddProductModalProps) {
  return (
    <ProductFormModal
      isOpen={isOpen}
      onClose={onClose}
      initialBarcode={initialBarcode}
      isEditMode={false}
      onSuccess={(product) => {
        onProductCreated(product, true);
      }}
    />
  );
}
