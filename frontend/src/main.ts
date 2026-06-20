import { Game } from './game';
import type { LevelData, GameReport, LevelBestReport, Rating } from './types';
import { healthCheck } from './api';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const game = new Game(canvas);

const levelNumEl = document.getElementById('level-num')!;
const creatureNameEl = document.getElementById('creature-name')!;
const connectedCountEl = document.getElementById('connected-count')!;
const totalCountEl = document.getElementById('total-count')!;
const progressFillEl = document.getElementById('progress-fill')!;
const hintTitleEl = document.getElementById('hint-title')!;
const hintTextEl = document.getElementById('hint-text')!;
const completeModal = document.getElementById('complete-modal')!;
const modalTitleEl = document.getElementById('modal-title')!;
const modalCreatureDescEl = document.getElementById('modal-creature-desc')!;
const modalRatingEl = document.getElementById('modal-rating')!;
const bestBadgeEl = document.getElementById('best-badge')!;
const reportTimeEl = document.getElementById('report-time')!;
const reportCorrectEl = document.getElementById('report-correct')!;
const reportWrongEl = document.getElementById('report-wrong')!;
const reportUndoEl = document.getElementById('report-undo')!;
const reportHintEl = document.getElementById('report-hint')!;

const btnUndo = document.getElementById('btn-undo') as HTMLButtonElement;
const btnReset = document.getElementById('btn-reset') as HTMLButtonElement;
const btnHint = document.getElementById('btn-hint') as HTMLButtonElement;
const btnNext = document.getElementById('btn-next') as HTMLButtonElement;

const MAX_LEVELS = 3;
const STORAGE_KEY = 'constellation_best_reports';

const RATING_ORDER: Record<Rating, number> = {
  'S': 5,
  'A': 4,
  'B': 3,
  'C': 2,
  'D': 1
};

function loadBestReports(): LevelBestReport {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveBestReports(reports: LevelBestReport): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch (err) {
    console.warn('保存最佳报告失败:', err);
  }
}

function isBetterReport(newReport: GameReport, oldReport: GameReport | undefined): boolean {
  if (!oldReport) return true;
  if (RATING_ORDER[newReport.rating] !== RATING_ORDER[oldReport.rating]) {
    return RATING_ORDER[newReport.rating] > RATING_ORDER[oldReport.rating];
  }
  if (newReport.timeSeconds !== oldReport.timeSeconds) {
    return newReport.timeSeconds < oldReport.timeSeconds;
  }
  if (newReport.wrongAttempts !== oldReport.wrongAttempts) {
    return newReport.wrongAttempts < oldReport.wrongAttempts;
  }
  return newReport.undoCount < oldReport.undoCount;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}分${secs}秒` : `${mins}分钟`;
}

let currentLevelData: LevelData | null = null;

game.setCallbacks({
  onLevelChange: (level: LevelData) => {
    currentLevelData = level;
    levelNumEl.textContent = String(level.id);
    creatureNameEl.textContent = level.creatureName;
    totalCountEl.textContent = String(level.edges.length);
    connectedCountEl.textContent = '0';
    progressFillEl.style.width = '0%';
    completeModal.classList.remove('show');
    bestBadgeEl.style.display = 'none';

    hintTitleEl.textContent = `关卡 ${level.id}: ${level.name}`;
    hintTextEl.textContent = '寻找闪烁频率成倍数关系的恒星，从一颗星拖动到另一颗星连接它们';
  },
  onProgressChange: (current: number, total: number) => {
    connectedCountEl.textContent = String(current);
    const pct = total > 0 ? (current / total) * 100 : 0;
    progressFillEl.style.width = `${pct}%`;

    if (current < total) {
      if (current === 0) {
        hintTitleEl.textContent = '观察星空';
        hintTextEl.textContent = '仔细观察星星的闪烁节奏，找到频率相同或成倍数的恒星';
      } else if (current < total * 0.3) {
        hintTitleEl.textContent = '初见端倪';
        hintTextEl.textContent = '做得好！继续寻找，你会发现恒星间的谐波共振关系';
      } else if (current < total * 0.6) {
        hintTitleEl.textContent = '星脉初现';
        hintTextEl.textContent = '神话生物的轮廓正在浮现，耐心连接剩余的星脉';
      } else if (current < total) {
        hintTitleEl.textContent = '即将完成';
        hintTextEl.textContent = '只剩最后几颗星了！神话生物即将显现';
      }
    }
  },
  onComplete: (report: GameReport) => {
    hintTitleEl.textContent = '✨ 星座完成 ✨';
    hintTextEl.textContent = '星界神话生物已显现！仔细欣赏它的光辉吧';

    modalTitleEl.childNodes[0].textContent = `✨ ${creatureNameEl.textContent} 降临 `;
    modalCreatureDescEl.textContent = currentLevelData?.creatureDescription ?? '';

    modalRatingEl.textContent = report.rating;
    modalRatingEl.className = `rating-badge rating-${report.rating}`;

    reportTimeEl.textContent = formatTime(report.timeSeconds);
    reportCorrectEl.textContent = String(report.correctConnections);
    reportWrongEl.textContent = String(report.wrongAttempts);
    reportUndoEl.textContent = String(report.undoCount);
    reportHintEl.textContent = report.viewedFrequencies ? '已查看' : '未查看';
    reportHintEl.className = `report-value ${report.viewedFrequencies ? 'bad' : 'good'}`;

    const bestReports = loadBestReports();
    const oldBest = bestReports[report.levelId];
    const isNewBest = isBetterReport(report, oldBest);
    if (isNewBest) {
      bestReports[report.levelId] = report;
      saveBestReports(bestReports);
      bestBadgeEl.style.display = 'inline-block';
    } else {
      bestBadgeEl.style.display = 'none';
    }

    completeModal.classList.add('show');

    if (game.getCurrentLevel() >= MAX_LEVELS) {
      btnNext.textContent = '重新开始';
    } else {
      btnNext.textContent = '下一关';
    }
  }
});

btnUndo.addEventListener('click', () => {
  game.undoLastConnection();
});

btnReset.addEventListener('click', () => {
  if (confirm('确定要重置本关吗？所有连线将被清除。')) {
    game.resetLevel();
  }
});

btnHint.addEventListener('click', () => {
  const showing = game.toggleFrequencies();
  btnHint.textContent = showing ? '隐藏频率' : '显示频率';
});

btnNext.addEventListener('click', async () => {
  const nextLevel = game.getCurrentLevel() >= MAX_LEVELS
    ? 1
    : game.getCurrentLevel() + 1;

  completeModal.classList.remove('show');
  btnHint.textContent = '显示频率';
  await game.loadLevel(nextLevel);
});

async function init(): Promise<void> {
  hintTitleEl.textContent = '加载中...';
  hintTextEl.textContent = '正在连接星界数据库...';

  try {
    const backendOk = await healthCheck();
    if (!backendOk) {
      console.warn('后端未启动，尝试使用嵌入数据...');
    }
  } catch {
    console.warn('后端健康检查失败');
  }

  const loaded = await game.loadLevel(1);
  if (!loaded) {
    hintTitleEl.textContent = '⚠️ 加载失败';
    hintTextEl.textContent = '无法加载关卡数据，请确保后端服务器已启动 (npm run dev:backend)';
    return;
  }

  game.start();
}

init().catch(err => {
  console.error('初始化失败:', err);
  hintTitleEl.textContent = '错误';
  hintTextEl.textContent = String(err);
});
