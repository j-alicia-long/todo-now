// Card variant for the Trash drawer: restore or permanently delete.

import { type Task } from "../domain/task-rules";
import { Icon } from "./ui";
import { daysAgo } from "../lib/presentation";

export const TrashCard = ({
  task,
  onRestore,
  onPermanentDelete,
}: {
  task: Task;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
}) => (
  <div className="task-card trash-card">
    <div className="card-header">
      <span className="card-title trashed">{task.title}</span>
    </div>
    {task.deletedAt && (
      <div className="trash-meta">Deleted {daysAgo(task.deletedAt)}</div>
    )}
    <div className="card-actions">
      <button
        className="card-action-btn undo"
        onClick={(e) => {
          e.stopPropagation();
          onRestore(task.id);
        }}
      >
        <Icon name="undo" /> Restore
      </button>
      <button
        className="card-action-btn delete-permanent"
        onClick={(e) => {
          e.stopPropagation();
          onPermanentDelete(task.id);
        }}
      >
        <Icon name="delete_forever" /> Delete forever
      </button>
    </div>
  </div>
);
