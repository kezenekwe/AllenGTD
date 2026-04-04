import {schemaMigrations, addColumns} from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'items',
          columns: [
            {name: 'calendar_event_id', type: 'string', isOptional: true},
          ],
        }),
      ],
    },
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'items',
          columns: [
            {name: 'project_id', type: 'string', isOptional: true},
            {name: 'project_step_id', type: 'string', isOptional: true},
          ],
        }),
        addColumns({
          table: 'project_steps',
          columns: [
            {name: 'is_completed', type: 'boolean'},
          ],
        }),
      ],
    },
  ],
});
