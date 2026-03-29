import {useState} from 'react';
import Item from '@services/database/models/Item';
import {itemRepository} from '@services/database/repositories/ItemRepository';
import {GTDCategory} from '@types/index';

// ─── useGTDWorkflow ────────────────────────────────────────────────────────
// Hook to manage the GTD processing workflow dialog

export function useGTDWorkflow() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<Item | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // ─── Open Dialog ───────────────────────────────────────────────────────

  const startProcessing = (item: Item) => {
    setCurrentItem(item);
    setIsDialogOpen(true);
  };

  // ─── Close Dialog ──────────────────────────────────────────────────────

  const closeDialog = () => {
    setIsDialogOpen(false);
    setCurrentItem(null);
  };

  // ─── Handle Workflow Completion ────────────────────────────────────────

  const handleComplete = async (
    action: string,
    payload?: {
      category?: GTDCategory;
      nextAction?: string;
      waitingFor?: string;
      projectPlan?: string;
      steps?: string[];
      hasCalendar?: boolean;
    },
  ) => {
    if (!currentItem) return;

    setIsProcessing(true);

    try {
      switch (action) {
        case 'moveToCategory':
          if (payload?.category) {
            await itemRepository.moveToCategory(currentItem, payload.category, {
              nextAction: payload.nextAction,
              waitingFor: payload.waitingFor,
              projectPlan: payload.projectPlan,
              steps: payload.steps,
              hasCalendar: payload.hasCalendar,
            });
          }
          break;

        case 'delete':
          await itemRepository.delete(currentItem);
          break;

        case 'complete':
          await itemRepository.complete(currentItem);
          break;
      }

      closeDialog();
    } catch (error) {
      console.error('Error processing item:', error);
      // Could set error state here for user feedback
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isDialogOpen,
    currentItem,
    isProcessing,
    startProcessing,
    closeDialog,
    handleComplete,
  };
}
