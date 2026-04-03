import { useState } from 'react';
import {
  formatClockFromIso,
  formatDateLong,
  formatSeconds,
  getDynamicLightRec,
  getEnergyMode,
  getSuggestions,
  getTaskFit,
  storageKeyForUser,
  toF,
} from '../lib/focusFlowCore.js';
import { HEALTH_OPTIONS } from '../lib/focusFlowData.js';

const WAKE_TIME_OPTIONS = [
  { label: 'Before 6am', value: 5.5 },
  { label: '6–7am', value: 6.5 },
  { label: '7–8am', value: 7.5 },
  { label: '8–9am', value: 8.5 },
  { label: '9–10am', value: 9.5 },
  { label: 'After 10am', value: 10.5 },
];

export function PlannerView({
  user,
  settings,
  activePhase,
  taskTimers,
  editingTaskId,
  editTitle,
  editMinutes,
  editDetails,
  applyDetailsToMatchingTemplates,
  collapsedPhases,
  quickAddInputs,
  checkInDone,
  wakeHour,
  dayCheck,
  routineOverridden,
  mindContext,
  mindAction,
  profileExpanded,
  phaseRemaining,
  phaseRunning,
  todayKey,
  greeting,
  weather,
  circadian,
  cycleInfo,
  cycleTip,
  activeProfile,
  proactiveTask,
  setSettingsPatch,
  setWakeHour,
  setProfileExpanded,
  setQuickAddInputs,
  setEditTitle,
  setEditMinutes,
  setEditDetails,
  setApplyDetailsToMatchingTemplates,
  togglePhaseCollapsed,
  handleStartPhase,
  handlePausePhase,
  handleResetPhase,
  toggleTask,
  toggleTaskTimer,
  resetTaskTimer,
  startEditTask,
  saveEditTask,
  cancelEditTask,
  deleteTask,
  addTaskToPhase,
  addSuggestionTask,
  suggestNextAction,
  handleSkipCheckin,
  handleDayCheck,
  handleCompleteCheckin,
  isFeatureEnabled,
  setRoutineOverridden,
}) {
  const [expandedTaskDetails, setExpandedTaskDetails] = useState(() => new Set());

  function toggleTaskDetails(taskId) {
    setExpandedTaskDetails((current) => {
      const next = new Set(current);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }

  return (
    <>
      {isFeatureEnabled('mind_context') && (
        <MindContextCard
          settings={settings}
          greeting={greeting}
          weather={weather}
          mindContext={mindContext}
          circadian={circadian}
          cycleInfo={cycleInfo}
          cycleTip={cycleTip}
          activeProfile={activeProfile}
          profileExpanded={profileExpanded}
          setProfileExpanded={setProfileExpanded}
        />
      )}

      <PhaseMap
        phases={settings.phases}
        activePhaseId={settings.activePhaseId}
        setSettingsPatch={setSettingsPatch}
      />

      {isFeatureEnabled('daily_check_in') && !checkInDone && (
        <CheckInCard
          user={user}
          settings={settings}
          todayKey={todayKey}
          wakeHour={wakeHour}
          dayCheck={dayCheck}
          routineOverridden={routineOverridden}
          setWakeHour={setWakeHour}
          setSettingsPatch={setSettingsPatch}
          setRoutineOverridden={setRoutineOverridden}
          handleSkipCheckin={handleSkipCheckin}
          handleDayCheck={handleDayCheck}
          handleCompleteCheckin={handleCompleteCheckin}
          deleteTask={deleteTask}
        />
      )}

      {isFeatureEnabled('proactive_suggestions') && (checkInDone || !isFeatureEnabled('daily_check_in')) && proactiveTask && (
        <div className="card proactive-card">
          <p className="card-label">Now</p>
          <p className="proactive-prompt">
            Based on your circadian window{cycleInfo ? `, ${cycleInfo.label.toLowerCase()} phase,` : ''} and attention state:
          </p>
          <p className="proactive-task">{proactiveTask.title}</p>
          {proactiveTask.minutes && <p className="proactive-meta">{proactiveTask.minutes} min · {activePhase.name}</p>}
        </div>
      )}

      <div className="day-plan">
        {settings.phases.map((phase, phaseIndex) => (
          <PhaseSection
            key={phase.id}
            phase={phase}
            phaseIndex={phaseIndex}
            phases={settings.phases}
            activePhase={activePhase}
            activePhaseId={settings.activePhaseId}
            routineType={settings.routineType}
            taskTimers={taskTimers}
            editingTaskId={editingTaskId}
            editTitle={editTitle}
            editMinutes={editMinutes}
            editDetails={editDetails}
            applyDetailsToMatchingTemplates={applyDetailsToMatchingTemplates}
            collapsedPhases={collapsedPhases}
            expandedTaskDetails={expandedTaskDetails}
            quickAddInputs={quickAddInputs}
            phaseRemaining={phaseRemaining}
            phaseRunning={phaseRunning}
            mindAction={mindAction}
            activeProfile={activeProfile}
            isTaskTimersEnabled={isFeatureEnabled('task_timers')}
            setQuickAddInputs={setQuickAddInputs}
            setEditTitle={setEditTitle}
            setEditMinutes={setEditMinutes}
            setEditDetails={setEditDetails}
            setApplyDetailsToMatchingTemplates={setApplyDetailsToMatchingTemplates}
            toggleTaskDetails={toggleTaskDetails}
            setSettingsPatch={setSettingsPatch}
            togglePhaseCollapsed={togglePhaseCollapsed}
            handleStartPhase={handleStartPhase}
            handlePausePhase={handlePausePhase}
            handleResetPhase={handleResetPhase}
            toggleTask={toggleTask}
            toggleTaskTimer={toggleTaskTimer}
            resetTaskTimer={resetTaskTimer}
            startEditTask={startEditTask}
            saveEditTask={saveEditTask}
            cancelEditTask={cancelEditTask}
            deleteTask={deleteTask}
            addTaskToPhase={addTaskToPhase}
            addSuggestionTask={addSuggestionTask}
            suggestNextAction={suggestNextAction}
          />
        ))}
      </div>
    </>
  );
}

function MindContextCard({
  settings,
  greeting,
  weather,
  mindContext,
  circadian,
  cycleInfo,
  cycleTip,
  activeProfile,
  profileExpanded,
  setProfileExpanded,
}) {
  const contextHour = mindContext.data?.hour ?? new Date().getHours();
  const lightRec = getDynamicLightRec(contextHour, weather, settings.healthState, cycleInfo);

  return (
    <div className="context-strip card">
      <div className="context-strip-top">
        <div>
          <span className="context-greeting">{greeting}.</span>
          <span className="context-date"> {formatDateLong()}</span>
        </div>
        {weather ? (
          <span className="context-weather-inline">
            {weather.summary} · {toF(weather.temperatureC)}°F
            {' · '}↑{formatClockFromIso(weather.sunrise, mindContext.data?.timeZone)}
            {' '}↓{formatClockFromIso(weather.sunset, mindContext.data?.timeZone)}
            {weather.uvNow != null ? ` · UV ${weather.uvNow}` : ''}
          </span>
        ) : mindContext.loading ? (
          <span className="context-weather-inline muted-copy">Loading…</span>
        ) : null}
      </div>

      {activeProfile ? (
        <div className="profile-block">
          <div
            className="profile-header"
            onClick={() => setProfileExpanded((current) => !current)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => event.key === 'Enter' && setProfileExpanded((current) => !current)}
          >
            <div>
              <span className="profile-name">{activeProfile.name}</span>
              <span className="profile-tagline"> — {activeProfile.tagline}</span>
            </div>
            <span className="profile-chevron">{profileExpanded ? '▾' : '▸'}</span>
          </div>
          {profileExpanded && (
            <div className="profile-detail">
              <p className="profile-detail-text">{activeProfile.detail}</p>
              {activeProfile.sources.length > 0 && (
                <div className="profile-sources">
                  {activeProfile.sources.map((source) => (
                    <a
                      key={source.url}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="profile-source-link"
                    >
                      {source.title}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="context-strip-circadian">
          <strong>{circadian.label}:</strong> {circadian.cognitive ?? circadian.body}
        </div>
      )}

      {cycleTip && <div className="context-cycle-tip">{cycleInfo.label} · day {cycleInfo.day} — {cycleTip}</div>}
      {lightRec && <div className="context-light-rec">☀ {lightRec}</div>}
    </div>
  );
}

function PhaseMap({ phases, activePhaseId, setSettingsPatch }) {
  let cumulativeHours = 0;

  return (
    <div className="card phase-map-card">
      {phases.map((phase) => {
        const startHour = cumulativeHours;
        cumulativeHours += phase.defaultMinutes / 60;
        const endHour = cumulativeHours;
        const isActive = phase.id === activePhaseId;
        const openTasks = (phase.tasks ?? []).filter((task) => !task.done).length;
        const formatHour = (value) => (Number.isInteger(value) ? `${value}h` : `${value.toFixed(1)}h`);

        return (
          <button
            key={phase.id}
            className={`phase-map-segment ${isActive ? 'active' : ''}`}
            onClick={() => setSettingsPatch({ activePhaseId: phase.id })}
          >
            <span className="phase-map-hours">{formatHour(startHour)}–{formatHour(endHour)}</span>
            <span className="phase-map-name">
              {phase.name}
              {openTasks > 0 && <span className="phase-map-badge">{openTasks}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CheckInCard({
  user,
  settings,
  todayKey,
  wakeHour,
  dayCheck,
  routineOverridden,
  setWakeHour,
  setSettingsPatch,
  setRoutineOverridden,
  handleSkipCheckin,
  handleDayCheck,
  handleCompleteCheckin,
  deleteTask,
}) {
  const needsReset = settings.preferences?.lastResetDate !== todayKey;
  const carryover = needsReset
    ? settings.phases.flatMap((phase) =>
        (phase.tasks ?? [])
          .filter((task) => task.type !== 'template' && !task.done)
          .map((task) => ({ ...task, phaseId: phase.id, phaseName: phase.name }))
      )
    : [];

  return (
    <div className="card check-in-card">
      <div className="check-in-header">
        <p className="card-label">Check-in</p>
        <button className="ghost small" onClick={handleSkipCheckin} aria-label="Skip check-in">
          ✕
        </button>
      </div>

      <p className="check-in-prompt">When did you wake up?</p>
      <div className="day-check-options">
        {WAKE_TIME_OPTIONS.map(({ label, value }) => (
          <button
            key={label}
            className={`day-check-btn ${wakeHour === value ? 'selected' : ''}`}
            onClick={() => {
              window.localStorage.setItem(storageKeyForUser(user?.id, `wakeHour:${todayKey}`), String(value));
              setWakeHour(value);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {wakeHour !== null && (
        <>
          <p className="check-in-prompt" style={{ marginTop: '0.85rem' }}>Body scan — how does today feel?</p>
          <div className="day-check-options">
            <button className={`day-check-btn ${dayCheck === 'better' ? 'selected' : ''}`} onClick={() => handleDayCheck('better')}>
              Good / Same
            </button>
            <button className={`day-check-btn warn ${dayCheck === 'mildly-worse' ? 'selected' : ''}`} onClick={() => handleDayCheck('mildly-worse')}>
              Mildly off
            </button>
            <button className={`day-check-btn danger ${dayCheck === 'clearly-worse' ? 'selected' : ''}`} onClick={() => handleDayCheck('clearly-worse')}>
              Rough day
            </button>
          </div>
          {dayCheck === 'mildly-worse' && (
            <p className="decision-note warn">Consider reducing long blocks and adding a movement break earlier in the day.</p>
          )}
          {dayCheck === 'clearly-worse' && !routineOverridden && (
            <div className="decision-note danger">
              <p style={{ margin: '0 0 0.5rem' }}>
                Switching to Integration Day — lighter blocks, more breaks, no pressure on deep work. Your repeating tasks will reflect this at reset.
              </p>
              <button
                className="ghost small"
                onClick={() => {
                  setSettingsPatch({ routineType: 'session' });
                  setRoutineOverridden(true);
                }}
              >
                Keep Session Day instead
              </button>
            </div>
          )}
          {dayCheck === 'clearly-worse' && routineOverridden && (
            <p className="decision-note warn">Keeping Session Day. Adjust scope as needed.</p>
          )}
        </>
      )}

      {wakeHour !== null && dayCheck && (
        <>
          <p className="check-in-prompt" style={{ marginTop: '0.85rem' }}>How is your attention right now?</p>
          <div className="health-grid">
            {HEALTH_OPTIONS.map((option) => (
              <button
                key={option.key}
                className={`health-option ${settings.healthState === option.key ? 'selected' : ''}`}
                onClick={() => setSettingsPatch({ healthState: option.key })}
              >
                {option.label}
              </button>
            ))}
          </div>

          {carryover.length > 0 && (
            <div className="carryover-section">
              <p className="check-in-prompt" style={{ marginTop: '0.85rem' }}>
                {carryover.length} task{carryover.length !== 1 ? 's' : ''} from yesterday
              </p>
              {carryover.map((task) => (
                <div key={task.id} className="carryover-task-row">
                  <div className="carryover-task-info">
                    <span className="carryover-task-title">{task.title}</span>
                    <span className="carryover-task-phase">{task.phaseName}</span>
                    {task.carryCount >= 2 && (
                      <span className={`carry-badge ${task.carryCount >= 3 ? 'carry-stuck' : ''}`}>
                        {task.carryCount >= 3 ? `${task.carryCount}d — revisit?` : `${task.carryCount}d`}
                      </span>
                    )}
                  </div>
                  <button className="ghost small" onClick={() => deleteTask(task.phaseId, task.id)}>
                    Let go
                  </button>
                </div>
              ))}
            </div>
          )}

          <button className="secondary" style={{ marginTop: '0.85rem' }} onClick={handleCompleteCheckin}>
            Into the day
          </button>
        </>
      )}
    </div>
  );
}

function PhaseSection({
  phase,
  phaseIndex,
  phases,
  activePhase,
  activePhaseId,
  routineType,
  taskTimers,
  editingTaskId,
  editTitle,
  editMinutes,
  editDetails,
  applyDetailsToMatchingTemplates,
  collapsedPhases,
  expandedTaskDetails,
  quickAddInputs,
  phaseRemaining,
  phaseRunning,
  mindAction,
  activeProfile,
  isTaskTimersEnabled,
  setQuickAddInputs,
  setEditTitle,
  setEditMinutes,
  setEditDetails,
  setApplyDetailsToMatchingTemplates,
  toggleTaskDetails,
  setSettingsPatch,
  togglePhaseCollapsed,
  handleStartPhase,
  handlePausePhase,
  handleResetPhase,
  toggleTask,
  toggleTaskTimer,
  resetTaskTimer,
  startEditTask,
  saveEditTask,
  cancelEditTask,
  deleteTask,
  addTaskToPhase,
  addSuggestionTask,
  suggestNextAction,
}) {
  const startHour = phases.slice(0, phaseIndex).reduce((sum, item) => sum + item.defaultMinutes / 60, 0);
  const endHour = startHour + phase.defaultMinutes / 60;
  const formatHour = (value) => (Number.isInteger(value) ? `${value}h` : `${value.toFixed(1)}h`);
  const isActive = phase.id === activePhaseId;
  const tasks = phase.tasks ?? [];
  const doneTasks = tasks.filter((task) => task.done).length;
  const energyMode = getEnergyMode(phase.name);
  const suggestions = getSuggestions(routineType, phase.name);
  const isCollapsed = collapsedPhases.has(phase.id);

  return (
    <section className={`phase-section ${isActive ? 'active' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
      <div
        className="phase-section-header"
        role="button"
        tabIndex={0}
        onClick={() => togglePhaseCollapsed(phase.id)}
        onKeyDown={(event) => event.key === 'Enter' && togglePhaseCollapsed(phase.id)}
      >
        <div className="phase-header-left">
          {isActive && <span className="active-dot" aria-label="Active phase" />}
          <div>
            <h3 className="phase-header-name">{phase.name}</h3>
            {!isCollapsed && <span className="phase-header-meta">{formatHour(startHour)}–{formatHour(endHour)} · {energyMode.mode}</span>}
          </div>
        </div>
        <div className="phase-header-right">
          <span className="phase-task-count">{doneTasks}/{tasks.length}</span>
          {isActive && !isCollapsed && (
            phaseRunning ? (
              <div className="phase-timer-inline">
                <span className="phase-timer-display">{formatSeconds(phaseRemaining)}</span>
                <button className="ghost small" onClick={(event) => { event.stopPropagation(); handlePausePhase(); }}>
                  Pause
                </button>
                <button className="ghost small" onClick={(event) => { event.stopPropagation(); handleResetPhase(); }}>
                  Reset
                </button>
              </div>
            ) : (
              <button
                className="secondary small"
                onClick={(event) => {
                  event.stopPropagation();
                  handleStartPhase();
                }}
              >
                ▶ {activePhase.defaultMinutes}m
              </button>
            )
          )}
          <span className="phase-chevron">{isCollapsed ? '▸' : '▾'}</span>
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div className="task-list">
            {tasks.map((task) => {
              const timer = taskTimers[task.id];
              const timerRunning = timer?.running ?? false;
              const timerSeconds = timer?.seconds ?? 0;
              const isEditing = editingTaskId === task.id;
              const detailsExpanded = expandedTaskDetails.has(task.id);
              const detailLines = String(task.details ?? '')
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean);
              const taskFit = getTaskFit(task, activeProfile);

              return (
                <article
                  key={task.id}
                  className={`task-row ${task.done ? 'done' : ''} ${isEditing ? 'editing' : ''} ${taskFit > 0 && !task.done ? 'fit-hint' : ''}`}
                >
                  {isEditing ? (
                    <form className="task-edit-form" onSubmit={(event) => { event.preventDefault(); saveEditTask(phase.id, task.id); }}>
                      <input type="text" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} autoFocus />
                      <input
                        type="number"
                        placeholder="min (optional)"
                        value={editMinutes}
                        onChange={(event) => setEditMinutes(event.target.value)}
                      />
                      <textarea
                        className="task-details-input"
                        rows={4}
                        placeholder="Task details/actions (one per line)"
                        value={editDetails}
                        onChange={(event) => setEditDetails(event.target.value)}
                      />
                      <label className="task-edit-scope">
                        <input
                          type="checkbox"
                          checked={applyDetailsToMatchingTemplates}
                          onChange={(event) => setApplyDetailsToMatchingTemplates(event.target.checked)}
                        />
                        Apply details to matching repeating tasks by name
                      </label>
                      <button type="submit">Save</button>
                      <button type="button" className="ghost" onClick={cancelEditTask}>
                        Cancel
                      </button>
                      <button type="button" className="ghost small danger-text" onClick={() => deleteTask(phase.id, task.id)}>
                        Delete
                      </button>
                    </form>
                  ) : (
                    <>
                      <button
                        className={`task-check ${task.done ? 'checked' : ''}`}
                        onClick={() => toggleTask(phase.id, task.id)}
                        aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}
                      />
                      <div className="task-copy">
                        <span className="task-title">{task.title}</span>
                        <div className="task-meta-row">
                          {task.type === 'template' && <span className="task-repeat-dot" title="Repeating task" />}
                          {task.type !== 'template' && task.carryCount > 0 && (
                            <span
                              className={`carry-badge${task.carryCount >= 3 ? ' carry-stuck' : ''}`}
                              title={`Carried over ${task.carryCount} day${task.carryCount !== 1 ? 's' : ''}`}
                            >
                              {task.carryCount >= 3 ? `${task.carryCount}d — revisit?` : `${task.carryCount}d`}
                            </span>
                          )}
                          {task.minutes && !timer && <span className="task-duration">{task.minutes} min</span>}
                          {timer && (
                            <span className="task-timer-running">
                              {timerRunning ? formatSeconds(timerSeconds) : `${formatSeconds(timerSeconds)} left`}
                              {' · '}{task.minutes}m total
                            </span>
                          )}
                        </div>
                        <div className="task-details">
                          <button
                            className="ghost small task-details-toggle"
                            onClick={() => toggleTaskDetails(task.id)}
                            type="button"
                          >
                            {detailsExpanded ? 'Hide actions' : `Show actions${detailLines.length > 0 ? ` (${detailLines.length})` : ''}`}
                          </button>
                          {detailsExpanded && (
                            detailLines.length > 0 ? (
                              <ul className="task-detail-list">
                                {detailLines.map((line, index) => (
                                  <li key={`${task.id}-detail-${index}`}>{line}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="muted-copy">No actions added yet. Use Edit to add task details.</p>
                            )
                          )}
                        </div>
                      </div>
                      <div className="task-actions">
                        {isTaskTimersEnabled && task.minutes && (
                          <button
                            className={`task-timer-btn ${timerRunning ? 'active' : ''}`}
                            onClick={() => toggleTaskTimer(task.id, task.minutes)}
                            title={timerRunning ? 'Pause timer' : `Start ${task.minutes}m timer`}
                          >
                            {timerRunning ? '⏸' : '▶'}
                          </button>
                        )}
                        {isTaskTimersEnabled && timer && (
                          <button className="ghost small" onClick={() => resetTaskTimer(task.id)} title="Reset timer">
                            ↺
                          </button>
                        )}
                        <button className="ghost small" onClick={() => startEditTask(task)}>
                          Edit
                        </button>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>

          <form
            className="quick-add-form"
            onSubmit={(event) => {
              event.preventDefault();
              addTaskToPhase(phase.id, quickAddInputs[phase.id] ?? '');
            }}
          >
            <input
              className="quick-add-input"
              type="text"
              placeholder="+ Add a task…"
              value={quickAddInputs[phase.id] ?? ''}
              onChange={(event) =>
                setQuickAddInputs((current) => ({
                  ...current,
                  [phase.id]: event.target.value,
                }))
              }
            />
          </form>

          {isActive && suggestions.length > 0 && (
            <div className="suggestion-strip">
              {suggestions.map((suggestion) => (
                <button key={suggestion.title} className="ghost small" onClick={() => addSuggestionTask(phase.id, suggestion)}>
                  + {suggestion.title}
                </button>
              ))}
            </div>
          )}

          {isActive && (
            <>
              <button className="ghost small suggest-btn" onClick={suggestNextAction}>
                Suggest next action
              </button>
              {mindAction && <p className="status-message">{mindAction}</p>}
            </>
          )}
        </>
      )}
    </section>
  );
}
