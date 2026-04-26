// ─── Item Service ─────────────────────────────────────────────────────────
// Business logic for items
// This will be implemented in Task 3.2

export class ItemService {
  async getAllItems(_userId: string) {
    return [];
  }

  async createItem(_userId: string, _data: any) {
    return null;
  }

  async updateItem(_userId: string, _itemId: string, _data: any) {
    return null;
  }

  async deleteItem(_userId: string, _itemId: string) {
    return null;
  }
}

export const itemService = new ItemService();
