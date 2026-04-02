export function SettingsView({
  settings,
  routineOptions,
  templateAddInputs,
  setTemplateAddInputs,
  applyRoutineTemplate,
  updatePhaseName,
  updatePhaseDefault,
  setSettingsPatch,
  deleteTask,
  addTemplateTaskToPhase,
  insertPhaseAt,
}) {
  return (
    <section className="card">
      <p className="card-label">Settings</p>
      <h3>Day template</h3>
      <p className="muted-copy">Choose how task suggestions populate your phases.</p>
      <div className="routine-grid">
        {routineOptions.map((option) => (
          <button
            key={option.key}
            className={`routine-chip ${settings.routineType === option.key ? 'active' : ''}`}
            onClick={() => applyRoutineTemplate(option.key)}
          >
            <strong>{option.label}</strong>
            <small>{option.note}</small>
          </button>
        ))}
      </div>
      <h3>Phase structure and defaults</h3>
      <div className="settings-phase-list">
        {settings.phases.map((phase, index) => (
          <div className="settings-phase-block" key={phase.id}>
            <button className="ghost small insert-btn" onClick={() => insertPhaseAt(index)}>
              + Insert phase above
            </button>
            <div className="settings-phase-row">
              <label>
                Phase name
                <input type="text" value={phase.name} onChange={(event) => updatePhaseName(phase.id, event.target.value)} />
              </label>
              <label>
                Default duration (min)
                <input
                  type="number"
                  min="1"
                  value={phase.defaultMinutes}
                  onChange={(event) => updatePhaseDefault(phase.id, event.target.value)}
                />
              </label>
              <button className="ghost small" onClick={() => setSettingsPatch({ activePhaseId: phase.id })}>Make active</button>
            </div>
            <div className="settings-template-tasks">
              <p className="field-label">Repeating tasks</p>
              {phase.tasks.filter((task) => task.type === 'template').map((task) => (
                <div key={task.id} className="settings-template-task-row">
                  <span className="settings-template-task-title">{task.title}</span>
                  {task.minutes && <span className="muted-copy">{task.minutes}m</span>}
                  <button className="ghost small danger-text" onClick={() => deleteTask(phase.id, task.id)}>x</button>
                </div>
              ))}
              <form
                className="settings-template-add"
                onSubmit={(event) => {
                  event.preventDefault();
                  const value = templateAddInputs[phase.id] ?? '';
                  addTemplateTaskToPhase(phase.id, value);
                  setTemplateAddInputs((current) => ({ ...current, [phase.id]: '' }));
                }}
              >
                <input
                  type="text"
                  placeholder="Add repeating task..."
                  value={templateAddInputs[phase.id] ?? ''}
                  onChange={(event) => setTemplateAddInputs((current) => ({ ...current, [phase.id]: event.target.value }))}
                />
              </form>
            </div>
          </div>
        ))}
        <button className="secondary" onClick={() => insertPhaseAt(settings.phases.length)}>+ Add phase at end</button>
      </div>
    </section>
  );
}
