const STATUS_INFO = {
  todo: { label: 'A Fazer', color: getComputedStyle(document.documentElement).getPropertyValue('--todo').trim() || '#f97316' },
  progress: { label: 'Progredindo', color: getComputedStyle(document.documentElement).getPropertyValue('--progress').trim() || '#0ea5e9' },
  done: { label: 'Concluída', color: getComputedStyle(document.documentElement).getPropertyValue('--done').trim() || '#22c55e' }
};

const DAY_LABELS = {
  segunda: 'Segunda-feira',
  terca: 'Terça-feira',
  quarta: 'Quarta-feira',
  quinta: 'Quinta-feira',
  sexta: 'Sexta-feira'
};

const STORAGE_KEY = 'dashboard-todo-state-v1';
const THEME_STORAGE_KEY = 'dashboard-theme-v1';
const DEFAULT_AVATAR_SRC = 'https://i.pravatar.cc/160?img=12';

function createTaskId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function escapeHtml(text) {
  const replacements = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  return String(text).replace(/[&<>"']/g, (char) => replacements[char]);
}

const initialTasks = [
  { id: createTaskId(), title: 'Planejar sprint', status: 'todo', day: 'segunda', start: '09:00', end: '10:30' },
  { id: createTaskId(), title: 'Reunião com equipe', status: 'progress', day: 'segunda', start: '11:00', end: '12:00' },
  { id: createTaskId(), title: 'Desenvolver feature', status: 'progress', day: 'terca', start: '13:30', end: '16:00' },
  { id: createTaskId(), title: 'Revisão de código', status: 'todo', day: 'quarta', start: '09:30', end: '11:00' },
  { id: createTaskId(), title: 'Testes automatizados', status: 'done', day: 'quinta', start: '10:00', end: '12:00' },
  { id: createTaskId(), title: 'Retrospectiva', status: 'done', day: 'sexta', start: '15:00', end: '16:00' }
];

let tasks = [...initialTasks];

const weeklyHours = {
  segunda: 6,
  terca: 7,
  quarta: 5,
  quinta: 6,
  sexta: 4
};

const weeklyCalendarEl = document.getElementById('weekly-calendar');
const progressBarsEl = document.getElementById('progress-bars');
const donutEl = document.getElementById('status-donut');
const legendEl = document.getElementById('percent-legend');
const agendaEl = document.getElementById('agenda');
const totalTasksEl = document.getElementById('total-tasks');
const counters = document.querySelectorAll('.counter-value');
const toggleFormBtn = document.getElementById('toggle-form');
const openFormBtn = document.getElementById('open-task-form');
const saveProjectBtn = document.getElementById('save-project');
const themeToggleIconBtn = document.getElementById('theme-toggle-icon');
const formEl = document.getElementById('task-form');
const cancelFormBtn = document.getElementById('cancel-task');
const avatarInput = document.getElementById('avatar-input');
const avatarPreview = document.getElementById('avatar-preview');

function sanitizeTask(task) {
  if (!task || typeof task !== 'object') return null;

  const status = ['todo', 'progress', 'done'].includes(task.status) ? task.status : 'todo';
  const day = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'].includes(task.day) ? task.day : 'segunda';
  const start = typeof task.start === 'string' ? task.start : '';
  const end = typeof task.end === 'string' ? task.end : '';
  const title = typeof task.title === 'string' ? task.title.trim() : '';

  if (!title || !start || !end) return null;

  return {
    id: typeof task.id === 'string' && task.id ? task.id : createTaskId(),
    title,
    status,
    day,
    start,
    end
  };
}

function loadSavedState() {
  try {
    const rawState = localStorage.getItem(STORAGE_KEY);
    if (!rawState) return;

    const parsedState = JSON.parse(rawState);
    if (Array.isArray(parsedState.tasks)) {
      const sanitizedTasks = parsedState.tasks
        .map(sanitizeTask)
        .filter(Boolean);

      if (sanitizedTasks.length) {
        tasks = sanitizedTasks;
      }
    }

    if (typeof parsedState.avatarSrc === 'string' && parsedState.avatarSrc.trim()) {
      if (avatarPreview) {
        avatarPreview.src = parsedState.avatarSrc;
      }
    }
  } catch (error) {
    console.warn('Não foi possível carregar o progresso salvo.', error);
  }
}

function saveProjectState(showFeedback = false) {
  try {
    const state = {
      tasks,
      avatarSrc: avatarPreview?.src || DEFAULT_AVATAR_SRC,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    if (showFeedback) {
      if (saveProjectBtn) {
        saveProjectBtn.textContent = 'Salvo!';
        setTimeout(() => {
          saveProjectBtn.textContent = 'Salvar progresso';
        }, 1500);
      }
    }
  } catch (error) {
    console.warn('Não foi possível salvar o progresso.', error);
  }
}


function setTheme(theme) {
  const normalizedTheme = theme === 'light' ? 'light' : 'dark';
  document.body.dataset.theme = normalizedTheme;

  if (themeToggleIconBtn) {
    const nextTheme = normalizedTheme === 'dark' ? 'light' : 'dark';
    themeToggleIconBtn.dataset.nextTheme = nextTheme;
    themeToggleIconBtn.setAttribute('aria-label', `Ativar ${nextTheme} mode`);
    themeToggleIconBtn.setAttribute('title', `Ativar ${nextTheme} mode`);
  }

  try {
    localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
  } catch (error) {
    console.warn('Não foi possível salvar o tema.', error);
  }
}

function loadThemePreference() {
  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    setTheme(storedTheme === 'light' ? 'light' : 'dark');
  } catch (error) {
    setTheme('dark');
  }
}

async function writeLogsToFolder() {
  if (!('showDirectoryPicker' in window)) {
    return false;
  }

  try {
    const rootHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    const logsHandle = await rootHandle.getDirectoryHandle('Logs', { create: true });

    const reportFile = await logsHandle.getFileHandle('progresso-atual.txt', { create: true });
    const reportWriter = await reportFile.createWritable();
    await reportWriter.write(createProgressReport());
    await reportWriter.close();

    const stateFile = await logsHandle.getFileHandle('estado-dashboard.json', { create: true });
    const stateWriter = await stateFile.createWritable();
    await stateWriter.write(JSON.stringify({ tasks, avatarSrc: avatarPreview?.src || DEFAULT_AVATAR_SRC, updatedAt: new Date().toISOString() }, null, 2));
    await stateWriter.close();

    return true;
  } catch (error) {
    console.warn('Não foi possível criar a pasta Logs automaticamente.', error);
    return false;
  }
}

function createProgressReport() {
  const lines = [
    'Relatório de progresso - Dashboard To Do',
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    '',
    `Total de tarefas: ${tasks.length}`,
    ''
  ];

  const dayOrder = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];
  dayOrder.forEach((dayKey) => {
    lines.push(`${formatLabel(dayKey)}:`);
    const dayTasks = tasks
      .filter((task) => task.day === dayKey)
      .sort((a, b) => a.start.localeCompare(b.start));

    if (!dayTasks.length) {
      lines.push('- Sem tarefas');
      lines.push('');
      return;
    }

    dayTasks.forEach((task) => {
      lines.push(`- ${task.start}-${task.end} | ${task.title} | ${STATUS_INFO[task.status].label}`);
    });
    lines.push('');
  });

  return lines.join('\n');
}

function downloadProgressReport() {
  try {
    const reportContent = createProgressReport();
    const now = new Date();
    const dateTag = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `progresso-tarefas-${dateTag}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.warn('Não foi possível exportar o relatório em .txt.', error);
  }
}

function renderWeeklyCalendar() {
  const today = new Date();
  const weekdays = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const normalizedWeekdays = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];

  weeklyCalendarEl.innerHTML = normalizedWeekdays
    .map((dayKey) => {
      const normalizedToday = weekdays[today.getDay()].normalize('NFD').replace(/\p{Diacritic}/gu, '');
      const isToday = normalizedToday === dayKey;
      return `
        <div class="week-day ${isToday ? 'current' : ''}">
          <strong>${DAY_LABELS[dayKey] || dayKey}</strong>
          <span>${weeklyHours[dayKey]} h trabalhadas</span>
        </div>
      `;
    })
    .join('');
}

function formatLabel(dayKey) {
  return DAY_LABELS[dayKey] || dayKey;
}

function updateProgressModules() {
  const totals = { todo: 0, progress: 0, done: 0 };
  tasks.forEach((task) => {
    if (totals[task.status] !== undefined) {
      totals[task.status] += 1;
    }
  });

  const totalTasks = tasks.length || 1;
  totalTasksEl.textContent = tasks.length;

  progressBarsEl.innerHTML = Object.entries(totals)
    .map(([status, count]) => {
      const percentage = Math.round((count / totalTasks) * 100);
      return `
        <div class="progress-item">
          <span class="progress-label">${STATUS_INFO[status].label}</span>
          <div class="progress-bar">
            <div class="progress-fill" style="background:${STATUS_INFO[status].color}; width:${percentage}%"></div>
          </div>
          <span class="progress-value">${percentage}%</span>
        </div>
      `;
    })
    .join('');

  counters.forEach((counter) => {
    const status = counter.dataset.status;
    counter.textContent = totals[status];
  });

  const percentages = Object.entries(totals).map(([status, count]) => ({
    status,
    count,
    percentage: totalTasks === 0 ? 0 : Math.round((count / totalTasks) * 100)
  }));

  let startAngle = 0;
  const segments = percentages
    .map(({ status, percentage }) => {
      const endAngle = startAngle + (360 * percentage) / 100;
      const segment = `${STATUS_INFO[status].color} ${startAngle}deg ${endAngle}deg`;
      startAngle = endAngle;
      return segment;
    })
    .join(', ');

  donutEl.style.background = percentages.every((item) => item.percentage === 0)
    ? 'conic-gradient(#e2e8f0 0deg 360deg)'
    : `conic-gradient(${segments})`;

  legendEl.innerHTML = percentages
    .map(({ status, percentage, count }) => `
      <li class="legend-item">
        <span class="legend-bullet" style="background:${STATUS_INFO[status].color}"></span>
        <div class="legend-text">
          <strong>${STATUS_INFO[status].label}</strong>
          <span>${percentage}% • ${count} tarefas</span>
        </div>
      </li>
    `)
    .join('');
}

function groupTasksByDay() {
  return tasks.reduce((acc, task) => {
    if (!acc[task.day]) acc[task.day] = [];
    acc[task.day].push(task);
    acc[task.day].sort((a, b) => a.start.localeCompare(b.start));
    return acc;
  }, {});
}

function renderAgenda() {
  const grouped = groupTasksByDay();
  const dayOrder = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];

  agendaEl.innerHTML = dayOrder
    .map((dayKey) => {
      const items = grouped[dayKey] || [];
      if (!items.length) {
        return `
          <div class="agenda-day">
            <header>
              <h3>${formatLabel(dayKey)}</h3>
              <span>Sem tarefas</span>
            </header>
          </div>
        `;
      }

      const taskItems = items
        .map(
          (task) => `
            <div class="task-item" data-id="${task.id}">
              <div>
                <p class="task-name">${escapeHtml(task.title)}</p>
                <p class="task-time">${task.start} - ${task.end}</p>
              </div>
              <span class="task-time">${STATUS_INFO[task.status].label}</span>
              <select class="task-status-select">
                <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>A Fazer</option>
                <option value="progress" ${task.status === 'progress' ? 'selected' : ''}>Progredindo</option>
                <option value="done" ${task.status === 'done' ? 'selected' : ''}>Concluída</option>
              </select>
            </div>
          `
        )
        .join('');

      return `
        <div class="agenda-day">
          <header>
            <h3>${formatLabel(dayKey)}</h3>
            <span>${items.length} ${items.length === 1 ? 'tarefa' : 'tarefas'}</span>
          </header>
          ${taskItems}
        </div>
      `;
    })
    .join('');
}

function updateDashboard() {
  updateProgressModules();
  renderAgenda();
}

function toggleForm(show) {
  formEl.hidden = !show;
  if (show) {
    formEl.querySelector('#task-title').focus();
  }
}

formEl?.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = document.getElementById('task-title').value.trim();
  const status = document.getElementById('task-status').value;
  const day = document.getElementById('task-day').value;
  const start = document.getElementById('task-start').value;
  const end = document.getElementById('task-end').value;

  if (!title || !start || !end) return;

  tasks.push({ id: createTaskId(), title, status, day, start, end });
  formEl.reset();
  toggleForm(false);
  updateDashboard();
  saveProjectState();
});

cancelFormBtn?.addEventListener('click', () => {
  formEl.reset();
  toggleForm(false);
});

openFormBtn?.addEventListener('click', () => toggleForm(true));
toggleFormBtn?.addEventListener('click', () => toggleForm(formEl.hidden));

agendaEl.addEventListener('change', (event) => {
  if (!event.target.classList.contains('task-status-select')) return;
  const taskItem = event.target.closest('.task-item');
  const taskId = taskItem?.dataset.id;
  if (!taskId) return;

  tasks = tasks.map((task) => (task.id === taskId ? { ...task, status: event.target.value } : task));
  updateDashboard();
  saveProjectState();
});

avatarInput?.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    if (avatarPreview) {
      avatarPreview.src = e.target?.result;
    }
    saveProjectState();
  };
  reader.readAsDataURL(file);
});

// Pomodoro timer logic
const WORK_DURATION = 25 * 60;
const BREAK_DURATION = 5 * 60;
let isWorkSession = true;
let remainingSeconds = WORK_DURATION;
let timerInterval = null;

const timerValueEl = document.getElementById('timer-value');
const timerLabelEl = document.querySelector('.timer-label');
const toggleTimerBtn = document.getElementById('toggle-timer');
const resetTimerBtn = document.getElementById('reset-timer');
const timerProgressEl = document.querySelector('.timer-progress');

function formatTime(seconds) {
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  return `${minutes}:${secs}`;
}

function updateTimerDisplay() {
  timerValueEl.textContent = formatTime(remainingSeconds);
  timerLabelEl.textContent = isWorkSession ? 'Foco' : 'Descanso';
  const total = isWorkSession ? WORK_DURATION : BREAK_DURATION;
  const progress = 1 - remainingSeconds / total;
  const circumference = 2 * Math.PI * 54;
  timerProgressEl.style.strokeDashoffset = circumference * (1 - progress);
}

function switchSession() {
  isWorkSession = !isWorkSession;
  remainingSeconds = isWorkSession ? WORK_DURATION : BREAK_DURATION;
  updateTimerDisplay();
}

function tick() {
  if (remainingSeconds > 0) {
    remainingSeconds -= 1;
    updateTimerDisplay();
  } else {
    switchSession();
  }
}

function startTimer() {
  if (timerInterval) return;
  timerInterval = setInterval(tick, 1000);
  toggleTimerBtn.textContent = 'Pausar';
}

function pauseTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  toggleTimerBtn.textContent = 'Iniciar';
}

function resetTimer() {
  pauseTimer();
  isWorkSession = true;
  remainingSeconds = WORK_DURATION;
  updateTimerDisplay();
}

function exportProgress() {
  try {
    const state = {
      tasks,
      avatarSrc: avatarPreview?.src || DEFAULT_AVATAR_SRC,
      updatedAt: new Date().toISOString()
    };
    
    const jsonString = JSON.stringify(state, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const now = new Date();
    const dateTag = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    
    link.href = url;
    link.download = `progresso-dashboard-${dateTag}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    
    // Feedback visual
    const exportBtn = document.getElementById('export-progress');
    if (exportBtn) {
      const originalText = exportBtn.textContent;
      exportBtn.textContent = 'Exportado!';
      setTimeout(() => {
        exportBtn.textContent = originalText;
      }, 1500);
    }
  } catch (error) {
    console.warn('Não foi possível exportar o progresso.', error);
    alert('Erro ao exportar progresso. Verifique o console para mais detalhes.');
  }
}

function loadProgress(file) {
  try {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const state = JSON.parse(content);
        
        if (!state.tasks || !Array.isArray(state.tasks)) {
          throw new Error('Arquivo inválido: não contém um array de tarefas');
        }
        
        // Sanitizar e carregar tarefas
        const sanitizedTasks = state.tasks
          .map(sanitizeTask)
          .filter(Boolean);
        
        if (sanitizedTasks.length > 0) {
          tasks = sanitizedTasks;
        } else {
          throw new Error('Nenhuma tarefa válida encontrada no arquivo');
        }
        
        // Carregar avatar se disponível
        if (typeof state.avatarSrc === 'string' && state.avatarSrc.trim()) {
          if (avatarPreview) {
            avatarPreview.src = state.avatarSrc;
          }
        }
        
        // Salvar estado e atualizar dashboard
        saveProjectState(false);
        updateDashboard();
        renderWeeklyCalendar();
        
        // Feedback visual
        const loadBtn = document.getElementById('load-progress');
        if (loadBtn) {
          const originalText = loadBtn.textContent;
          loadBtn.textContent = 'Carregado!';
          setTimeout(() => {
            loadBtn.textContent = originalText;
          }, 1500);
        }
      } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        alert(`Erro ao carregar progresso: ${error.message}`);
      }
    };
    reader.readAsText(file);
  } catch (error) {
    console.warn('Não foi possível carregar o progresso.', error);
    alert('Erro ao carregar progresso. Verifique se o arquivo é válido.');
  }
}

toggleTimerBtn?.addEventListener('click', () => {
  if (timerInterval) {
    pauseTimer();
  } else {
    startTimer();
  }
});

resetTimerBtn?.addEventListener('click', resetTimer);

saveProjectBtn?.addEventListener('click', async () => {
  saveProjectState(true);
  const wroteLogs = await writeLogsToFolder();
  if (!wroteLogs) {
    downloadProgressReport();
  }
});

themeToggleIconBtn?.addEventListener('click', () => {
  const currentTheme = document.body.dataset.theme === 'light' ? 'light' : 'dark';
  setTheme(currentTheme === 'dark' ? 'light' : 'dark');
});

const exportProgressBtn = document.getElementById('export-progress');
exportProgressBtn?.addEventListener('click', exportProgress);

const loadProgressBtn = document.getElementById('load-progress');
const fileInputLoad = document.getElementById('file-input-load');

loadProgressBtn?.addEventListener('click', () => {
  fileInputLoad.click();
});

fileInputLoad?.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (file) {
    loadProgress(file);
    fileInputLoad.value = '';
  }
});

// Dashboard accordion toggle
const dashboardToggleBtn = document.getElementById('dashboard-accordion-toggle');
const dashboardPanel = document.getElementById('dashboard-accordion-panel');
if (dashboardToggleBtn && dashboardPanel) {
  // initial state: respect aria-expanded attribute (button starts with "false")
  dashboardPanel.hidden = dashboardToggleBtn.getAttribute('aria-expanded') !== 'true';

  dashboardToggleBtn.addEventListener('click', () => {
    const expanded = dashboardToggleBtn.getAttribute('aria-expanded') === 'true';
    // toggle attribute
    dashboardToggleBtn.setAttribute('aria-expanded', String(!expanded));
    dashboardPanel.hidden = !expanded ? false : true;
  });
}

loadThemePreference();
loadSavedState();
renderWeeklyCalendar();
updateDashboard();
updateTimerDisplay();
