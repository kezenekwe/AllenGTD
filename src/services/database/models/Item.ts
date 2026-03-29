import {Model, Query} from '@nozbe/watermelondb';
import {
  field,
  date,
  readonly,
  children,
} from '@nozbe/watermelondb/decorators';
import {Associations} from '@nozbe/watermelondb/Model';
import ProjectStep from './ProjectStep';
import {GTDCategory, ItemStatus} from '../../types';

export default class Item extends Model {
  static table = 'items';

  static associations: Associations = {
    project_steps: {type: 'has_many', foreignKey: 'project_id'},
  };

  // ─── Core Fields ────────────────────────────────────────────────────────

  @field('text') text!: string;
  @field('category') category!: GTDCategory;
  @field('status') status!: ItemStatus;

  // ─── GTD-Specific Fields ────────────────────────────────────────────────

  @field('next_action') nextAction!: string | null;
  @field('waiting_for') waitingFor!: string | null;
  @field('project_plan') projectPlan!: string | null;
  @field('has_calendar') hasCalendar!: boolean;

  // ─── Sync Fields ────────────────────────────────────────────────────────

  @field('server_id') serverId!: string | null;
  @date('synced_at') syncedAt!: Date | null;

  // ─── Timestamps (auto-managed by WatermelonDB) ──────────────────────────

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
  @date('completed_at') completedAt!: Date | null;

  // ─── Relationships ───────────────────────────────────────────────────────

  @children('project_steps') steps!: Query<ProjectStep>;
}
