export type TriggerType =
  | 'member_joined'
  | 'message_created'
  | 'image_uploaded'
  | 'gpx_uploaded'
  | 'slash_command'
  | 'card_interaction'
  | 'webhook';

export type ActionType =
  | 'send_message'
  | 'send_admin_message'
  | 'add_role'
  | 'remove_role'
  | 'copy_images_to_gallery'
  | 'copy_routes_to_library'
  | 'show_card'
  | 'update_card'
  | 'dismiss_card'
  | 'send_webhook';

export type ConditionType =
  | 'user_has_role'
  | 'channel_is'
  | 'message_contains'
  | 'message_equals'
  | 'command_arg_equals'
  | 'card_field_equals'
  | 'card_field_not_null'
  | 'invite_code_is'
  | 'button_is'
  | 'webhook_payload_equals';

export interface ConditionRule {
  type: ConditionType;
  config: Record<string, any>;
  negate?: boolean;
}

export interface ConditionGroup {
  operator: 'AND' | 'OR';
  rules: Array<ConditionRule | ConditionGroup>;
}

export interface WorkflowAction {
  type: ActionType;
  config: Record<string, any>;
}

export interface Workflow {
  id: string;
  spaceId: string;
  name: string;
  description: string | null;
  triggerType: TriggerType;
  triggerConfig: Record<string, any> | null;
  conditions: ConditionGroup | null;
  actions: WorkflowAction[];
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type WorkflowExecutionStatus = 'success' | 'partial' | 'error' | 'skipped';

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  spaceId: string;
  triggerUserId: string | null;
  triggerType: string;
  triggerData: Record<string, any> | null;
  status: WorkflowExecutionStatus;
  actionsRun: number;
  actionsTotal: number;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  workflowName?: string;
}

export type CommandArgType = 'text' | 'number' | 'user' | 'channel' | 'role' | 'boolean';

export interface CommandArg {
  name: string;
  type: CommandArgType;
  required: boolean;
  description: string;
}

export interface CustomCommand {
  id: string;
  spaceId: string;
  name: string;
  description: string;
  args: CommandArg[] | null;
  createdBy: string;
  createdAt: string;
}

export type CardButtonStyle = 'primary' | 'secondary' | 'danger';

export interface CardButton {
  id: string;
  label: string;
  style: CardButtonStyle;
}

export type CardFieldType = 'text' | 'select' | 'role' | 'user' | 'channel';

export interface CardField {
  key: string;
  label: string;
  type: CardFieldType;
  options?: string[];
}

export interface CardTemplate {
  id: string;
  spaceId: string;
  name: string;
  titleTemplate: string;
  bodyTemplate: string | null;
  color: string | null;
  fields: CardField[] | null;
  buttons: CardButton[] | null;
  createdBy: string;
  createdAt: string;
}

export type CardInstanceStatus = 'active' | 'dismissed' | 'expired';

export interface CardInstance {
  id: string;
  templateId: string;
  channelId: string;
  messageId: string | null;
  context: Record<string, any> | null;
  state: Record<string, any> | null;
  status: CardInstanceStatus;
  interactedBy: string | null;
  interactedAt: string | null;
  createdAt: string;
  updatedAt: string;
  template?: CardTemplate;
}
