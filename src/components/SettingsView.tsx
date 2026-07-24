// Settings drawer panel: card-label visibility toggles.

import { type Settings } from "../stores/hooks";

export const SettingsView = ({
  settings,
  onToggle,
}: {
  settings: Settings;
  onToggle: (key: keyof Settings) => void;
}) => {
  const toggles: { key: keyof Settings; label: string; description: string }[] =
    [
      {
        key: "showArea",
        label: "Area",
        description: "Show category label (Life Admin, Social, etc.)",
      },
    ];

  return (
    <div className="settings-view">
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
    </div>
  );
};
