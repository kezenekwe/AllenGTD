import {database, itemsCollection, stepsCollection} from '../index';
import {Q} from '@nozbe/watermelondb';
import Item from '../models/Item';
import {GTDCategory} from '../../../types';

// ─── ItemRepository ────────────────────────────────────────────────────────
// All database operations for items go through here.
// Business logic does NOT live here — only data access.

export class ItemRepository {

  // ─── Observables (reactive queries) ──────────────────────────────────────
  // These return RxJS observables. UI hooks subscribe and auto-update.

  observeByCategory(category: GTDCategory) {
    return itemsCollection
      .query(
        Q.where('category', category),
        Q.where('status', 'active'),
        Q.sortBy('created_at', Q.desc),
      )
      .observe();
  }

  observeInbox() {
    return this.observeByCategory('inbox');
  }

  // ─── One-off Fetches ──────────────────────────────────────────────────────

  async findById(id: string): Promise<Item | null> {
    try {
      return await itemsCollection.find(id);
    } catch {
      return null; // WatermelonDB throws if not found
    }
  }

  async fetchByCategory(category: GTDCategory): Promise<Item[]> {
    return itemsCollection
      .query(
        Q.where('category', category),
        Q.where('status', 'active'),
        Q.sortBy('created_at', Q.desc),
      )
      .fetch();
  }

  // Items that haven't been synced yet
  async fetchUnsynced(): Promise<Item[]> {
    return itemsCollection
      .query(Q.where('synced_at', Q.eq(null)))
      .fetch();
  }

  // ─── Write Operations ─────────────────────────────────────────────────────

  async addToInbox(text: string): Promise<Item> {
    return database.write(async () => {
      return itemsCollection.create(item => {
        item.text = text;
        item.category = 'inbox';
        item.status = 'active';
        item.hasCalendar = false;
      });
    });
  }

  async moveToCategory(
    item: Item,
    category: GTDCategory,
    extraFields?: {
      nextAction?: string;
      waitingFor?: string;
      projectPlan?: string;
      steps?: string[];
      hasCalendar?: boolean;
    },
  ): Promise<Item> {
    return database.write(async () => {
      const preparedUpdate = item.prepareUpdate(i => {
        i.category = category;

        if (extraFields?.nextAction !== undefined) {
          i.nextAction = extraFields.nextAction;
        }
        if (extraFields?.waitingFor !== undefined) {
          i.waitingFor = extraFields.waitingFor;
        }
        if (extraFields?.projectPlan !== undefined) {
          i.projectPlan = extraFields.projectPlan;
        }
        if (extraFields?.hasCalendar !== undefined) {
          i.hasCalendar = extraFields.hasCalendar;
        }
      });

      const preparedSteps = (extraFields?.steps ?? []).map((stepText, i) =>
        stepsCollection.prepareCreate(step => {
          step.projectId = item.id;
          step.stepText = stepText;
          step.stepOrder = i;
        }),
      );

      await database.batch(preparedUpdate, ...preparedSteps);
      return item;
    });
  }

  async complete(item: Item): Promise<void> {
    await database.write(async () => {
      await item.update(i => {
        i.status = 'completed';
        i.completedAt = new Date();
      });
    });
  }

  async delete(item: Item): Promise<void> {
    await database.write(async () => {
      await item.markAsDeleted(); // soft delete
    });
  }

  async markSynced(item: Item, serverId: string): Promise<void> {
    await database.write(async () => {
      await item.update(i => {
        i.serverId = serverId;
        i.syncedAt = new Date();
      });
    });
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  async countCompleted(): Promise<number> {
    const completed = await itemsCollection
      .query(Q.where('status', 'completed'))
      .fetchCount();
    return completed;
  }
}

// Singleton export — import this everywhere
export const itemRepository = new ItemRepository();
