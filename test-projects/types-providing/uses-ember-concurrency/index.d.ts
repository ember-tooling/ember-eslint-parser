import type { Task } from 'ember-concurrency'

export interface PopupHandle {
  closeTask: Task<void, [source?: string, event?: Event]>;
  showPopup: () => Promise<void>;
}
