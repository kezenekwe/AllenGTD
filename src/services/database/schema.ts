import {appSchema, tableSchema} from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 3,
  tables: [
    tableSchema({
      name: 'items',
      columns: [
        {name: 'text', type: 'string'},
        {name: 'category', type: 'string', isIndexed: true},
        {name: 'status', type: 'string', isIndexed: true},

        // GTD-specific
        {name: 'next_action', type: 'string', isOptional: true},
        {name: 'waiting_for', type: 'string', isOptional: true},
        {name: 'project_plan', type: 'string', isOptional: true},
        {name: 'has_calendar', type: 'boolean'},
        {name: 'project_id', type: 'string', isOptional: true},
        {name: 'project_step_id', type: 'string', isOptional: true},
        {name: 'calendar_event_id', type: 'string', isOptional: true},

        // Sync
        {name: 'server_id', type: 'string', isOptional: true, isIndexed: true},
        {name: 'synced_at', type: 'number', isOptional: true},

        // Timestamps (WatermelonDB stores dates as Unix ms)
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
        {name: 'completed_at', type: 'number', isOptional: true},
      ],
    }),

    tableSchema({
      name: 'project_steps',
      columns: [
        // project_id is a foreign key — indexed for fast look-ups
        {name: 'project_id', type: 'string', isIndexed: true},
        {name: 'step_text', type: 'string'},
        {name: 'step_order', type: 'number'},
        {name: 'is_completed', type: 'boolean'},
        {name: 'created_at', type: 'number'},
      ],
    }),
  ],
});
