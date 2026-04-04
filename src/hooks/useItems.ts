import {useState, useEffect} from 'react';
import {itemRepository} from '@services/database/repositories/ItemRepository';
import {itemsCollection, stepsCollection, database} from '@services/database';
import Item from '@services/database/models/Item';
import type {GTDCategory} from '@services/database/models/Item';

export {useItemsByCategory, useInboxItems, useItemActions};

// ─── useItemsByCategory ────────────────────────────────────────────────────

function useItemsByCategory(category: GTDCategory) {
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const subscription = itemRepository
      .observeByCategory(category)
      .subscribe({
        next: updatedItems => {
          setItems(updatedItems);
          setIsLoading(false);
        },
        error: err => {
          console.error(`Error observing ${category}:`, err);
          setIsLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, [category]);

  return {items, isLoading};
}

// ─── useInboxItems ─────────────────────────────────────────────────────────

function useInboxItems() {
  return useItemsByCategory('inbox');
}

// ─── useItemActions ────────────────────────────────────────────────────────

export function useItemActions() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAction = async (action: () => Promise<unknown>) => {
    setIsLoading(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong';
      setError(message);
      console.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const addToInbox = (text: string) =>
    runAction(() => itemRepository.addToInbox(text));

  const deleteItem = (item: Item) =>
    runAction(() => itemRepository.delete(item));

  const completeItem = (item: Item) =>
    runAction(() => itemRepository.complete(item));

  const moveToCategory = (
    item: Item,
    category: GTDCategory,
    extras?: Parameters<typeof itemRepository.moveToCategory>[2],
  ) => runAction(() => itemRepository.moveToCategory(item, category, extras));

  // Direct add to any category (bypasses inbox workflow)
  const directAddToCategory = async (
    text: string,
    category: GTDCategory,
    extras?: {
      nextAction?: string;
      waitingFor?: string;
      projectPlan?: string;
      steps?: string[];
      hasCalendar?: boolean;
    },
  ) => {
    await runAction(async () => {
      await database.write(async () => {
        const preparedItem = itemsCollection.prepareCreate(newItem => {
          newItem.text = text;
          newItem.category = category;
          newItem.status = 'active';
          newItem.hasCalendar = extras?.hasCalendar || false;
          newItem.nextAction = extras?.nextAction || null;
          newItem.waitingFor = extras?.waitingFor || null;
          newItem.projectPlan = extras?.projectPlan || null;
        });

        const preparedSteps = (extras?.steps ?? []).map((stepText, i) =>
          stepsCollection.prepareCreate(step => {
            // Use _raw to set the foreign key directly
            step._raw.project_id = preparedItem.id;
            step.stepText = stepText;
            step.stepOrder = i;
            step.isCompleted = false;
          }),
        );

        await database.batch(preparedItem, ...preparedSteps);
      });
    });
  };

  return {
    addToInbox,
    deleteItem,
    completeItem,
    moveToCategory,
    directAddToCategory,
    isLoading,
    error,
  };
}
