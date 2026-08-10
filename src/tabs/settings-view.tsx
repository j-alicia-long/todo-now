// Settings drawer panel: default board view picker and card-label
// visibility toggles.

import {
  type BoardView,
  type BooleanSettingKey,
  type Settings,
} from "../stores/hooks";
import { KeyHint } from "../components/kit/key-hint";
import { Icon } from "../components/kit/icon";

const VIEW_OPTIONS: { value: BoardView; label: string; icon: string }[] = [
  { value: "columns", label: "Columns", icon: "view_week" },
  { value: "matrix", label: "Matrix", icon: "grid_view" },
];

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const MOD = isMac ? "⌘" : "Ctrl";

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: `${MOD} ⇧ P`, label: "Open Report Mode" },
  { keys: "Enter", label: "Report Mode: open the compose window" },
  { keys: "⇧ Enter", label: "Compose window: save the report" },
  { keys: "Esc", label: "Step back / exit Report Mode" },
  { keys: "1", label: "Matrix triage: sort the card (keys 1–4 = quadrants)" },
  { keys: "S", label: "Matrix triage: skip the card" },
];

export const SettingsView = ({
  settings,
  onToggle,
  onSetDefaultView,
}: {
  settings: Settings;
  onToggle: (key: BooleanSettingKey) => void;
  onSetDefaultView: (view: BoardView) => void;
}) => {
  const toggles: {
    key: BooleanSettingKey;
    label: string;
    description: string;
  }[] = [
    {
      key: "showArea",
      label: "Area",
      description: "Show category label (Life Admin, Social, etc.)",
    },
  ];

  return (
    <div className="settings-view">
      <h2 className="settings-title">Default Board View</h2>
      <p className="settings-desc">Choose which view the Board tab opens in.</p>
      <div className="board-view-toggle settings-view-picker" role="radiogroup">
        {VIEW_OPTIONS.map(({ value, label, icon }) => (
          <button
            key={value}
            role="radio"
            aria-checked={settings.defaultBoardView === value}
            className={`board-view-btn ${settings.defaultBoardView === value ? "active" : ""}`}
            onClick={() => onSetDefaultView(value)}
          >
            <Icon name={icon} /> {label}
          </button>
        ))}
      </div>
      <h2 className="settings-title">Card Labels</h2>
      <p className="settings-desc">Choose which labels appear on task cards.</p>
      <div className="settings-list">
        {toggles.map(({ key, label, description }) => (
          <label key={key} className="settings-toggle">
            <div className="toggle-info">
              <span className="toggle-label">{label}</span>
              <span className="toggle-desc">{description}</span>
            </div>
            <div
              className={`toggle-switch ${settings[key] ? "on" : ""}`}
              onClick={() => onToggle(key)}
            >
              <div className="toggle-knob" />
            </div>
          </label>
        ))}
      </div>
      <h2 className="settings-title">Bug Reports</h2>
      <p className="settings-desc">
        Report Mode: shake (mobile) or ⌘⇧P (desktop), tap elements to highlight,
        then describe the bug or idea.
      </p>
      <div className="settings-list">
        <label className="settings-toggle">
          <div className="toggle-info">
            <span className="toggle-label">Shake to report</span>
            <span className="toggle-desc">
              Shake your phone to open Report Mode
            </span>
          </div>
          <div
            className={`toggle-switch ${settings.shakeToReport ? "on" : ""}`}
            onClick={() => onToggle("shakeToReport")}
          >
            <div className="toggle-knob" />
          </div>
        </label>
      </div>
      <h2 className="settings-title">Keyboard Shortcuts</h2>
      <p className="settings-desc">Speed things up from the keyboard.</p>
      <div className="settings-shortcuts">
        {SHORTCUTS.map(({ keys, label }) => (
          <div key={label} className="settings-shortcut-row">
            <span className="settings-shortcut-label">{label}</span>
            <KeyHint display={keys} />
          </div>
        ))}
      </div>
    </div>
  );
};
