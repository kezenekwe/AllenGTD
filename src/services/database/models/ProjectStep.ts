import {Model} from '@nozbe/watermelondb';
import {field, date, readonly, relation} from '@nozbe/watermelondb/decorators';
import {Associations} from '@nozbe/watermelondb/Model';
import Item from './Item';

export default class ProjectStep extends Model {
  static table = 'project_steps';

  static associations: Associations = {
    items: {type: 'belongs_to', key: 'project_id'},
  };

  @field('project_id') projectId!: string;
  @field('step_text') stepText!: string;
  @field('step_order') stepOrder!: number;
  @field('is_completed') isCompleted!: boolean;

  @readonly @date('created_at') createdAt!: Date;

  @relation('items', 'project_id') project!: Item;
}
