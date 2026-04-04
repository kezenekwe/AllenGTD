// ─── Item Service ─────────────────────────────────────────────────────────
// Business logic for items
// This will be implemented in Task 3.2

export class ItemService {
  async getAllItems(userId: string) {
    // TODO: Implement
    return [];
  }

  async createItem(userId: string, data: any) {
    // TODO: Implement
    return null;
  }

  async updateItem(userId: string, itemId: string, data: any) {
    // TODO: Implement
    return null;
  }

  async deleteItem(userId: string, itemId: string) {
    // TODO: Implement
    return null;
  }
}

export const itemService = new ItemService();
