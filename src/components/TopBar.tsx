import {
  BookOpen,
  BookOpenCheck,
  CalendarDays,
  CalendarRange,
  Check,
  ClipboardList,
  FileText,
  FolderOpen,
  Gamepad2,
  HelpCircle,
  Home,
  ListChecks,
  LucideIcon,
  SlidersHorizontal,
} from 'lucide-react';
import { TeacherProfile } from '../types/portal';
import { PWAInstallButton } from './PWAInstallButton';

export type ActiveTab =
  | 'dashboard'
  | 'cp-materi'
  | 'tp-atp'
  | 'prota'
  | 'prosem'
  | 'rpm'
  | 'agenda'
  | 'assessment'
  | 'game'
  | 'folder';

export interface WorkspaceNavItem {
  id: ActiveTab;
  label: string;
  shortLabel: string;
  group: 'utama' | 'perangkat' | 'evaluasi';
  stepNum?: number;
  icon: LucideIcon;
}

export const WORKSPACE_NAV_ITEMS: WorkspaceNavItem[] = [
  { id: 'dashboard', label: 'Beranda', shortLabel: 'Beranda', group: 'utama', icon: Home },
  {
    id: 'cp-materi',
    label: 'CP dan Materi',
    shortLabel: 'CP & Materi',
    group: 'perangkat',
    stepNum: 1,
    icon: BookOpen,
  },
  {
    id: 'tp-atp',
    label: 'TP dan ATP',
    shortLabel: 'TP & ATP',
    group: 'perangkat',
    stepNum: 2,
    icon: ListChecks,
  },
  {
    id: 'prota',
    label: 'PROTA',
    shortLabel: 'PROTA',
    group: 'perangkat',
    stepNum: 3,
    icon: CalendarRange,
  },
  {
    id: 'prosem',
    label: 'PROSEM',
    shortLabel: 'PROSEM',
    group: 'perangkat',
    stepNum: 4,
    icon: CalendarDays,
  },
  {
    id: 'rpm',
    label: 'RPM',
    shortLabel: 'RPM',
    group: 'perangkat',
    stepNum: 5,
    icon: BookOpenCheck,
  },
  {
    id: 'agenda',
    label: 'Agenda Harian',
    shortLabel: 'Agenda',
    group: 'perangkat',
    stepNum: 6,
    icon: ClipboardList,
  },
  {
    id: 'assessment',
    label: 'Asesmen STS/SAS',
    shortLabel: 'Asesmen',
    group: 'evaluasi',
    icon: FileText,
  },
  { id: 'game', label: 'Game Edukasi', shortLabel: 'Game', group: 'evaluasi', icon: Gamepad2 },
  { id: 'folder', label: 'Folder Saya', shortLabel: 'Folder Saya', group: 'evaluasi', icon: FolderOpen },
];

export interface WorkflowReadyState {
  cpMateri?: boolean;
  tpAtp?: boolean;
  prota?: boolean;
  prosem?: boolean;
  rpm?: boolean;
  agenda?: boolean;
}

interface TopBarProps {
  teacher: TeacherProfile;
  teacherNip?: string;
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  onSwitchTeacher: () => void;
  simpleMode?: boolean;
  onToggleSimpleMode?: () => void;
  onOpenHelp?: () => void;
}

export function TopBar({
  teacher,
  teacherNip,
  activeTab,
  onChangeTab,
  onSwitchTeacher,
  simpleMode = true,
  onToggleSimpleMode,
  onOpenHelp,
}: TopBarProps) {
  const activeItem = WORKSPACE_NAV_ITEMS.find((item) => item.id === activeTab);

  return (
    <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand + Context Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => onChangeTab('dashboard')}
            className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-sky-700 transition-colors"
          >
            Portal Guru SDN Lendang Telaga
          </button>
          <span className="hidden xl:inline text-slate-300" aria-hidden="true">
            /
          </span>
          <span className="hidden xl:inline text-sm font-semibold text-sky-700 whitespace-nowrap truncate">
            {activeItem?.label || 'Beranda'}
          </span>
        </div>

        {/* Zone 2: Mode Toggle, Offline/Install, Bantuan, Teacher Profile Switcher */}
        <div className="flex items-center gap-2 shrink-0 overflow-x-auto">
          {teacherNip && (
            <span className="hidden 2xl:inline-block text-[11px] font-mono text-slate-500 tabular-nums mr-1">
              NIP. {teacherNip}
            </span>
          )}
          <PWAInstallButton compact />
          {onToggleSimpleMode && (
            <button
              type="button"
              onClick={onToggleSimpleMode}
              className={`touch-target px-3 py-2 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 border ${
                simpleMode
                  ? 'bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
              title="Ubah antara Tampilan Sederhana (panduan 3 langkah) dan Mode Lengkap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {simpleMode ? 'Tampilan: Sederhana' : 'Tampilan: Lengkap'}
              </span>
              <span className="sm:hidden">{simpleMode ? 'Sederhana' : 'Lengkap'}</span>
            </button>
          )}
          {onOpenHelp && (
            <button
              type="button"
              onClick={onOpenHelp}
              className="touch-target px-3 py-2 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              title="Buka Panduan Singkat untuk Guru"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
              <span>Bantuan</span>
            </button>
          )}
          <button
            type="button"
            onClick={onSwitchTeacher}
            className="hidden md:inline-flex touch-target px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
            title="Kembali ke Laman Awal Pilih Profil Guru"
          >
            Laman Awal
          </button>
          <button
            type="button"
            onClick={onSwitchTeacher}
            className="touch-target px-3.5 sm:px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors whitespace-nowrap shrink-0"
            title="Ganti Profil Guru"
          >
            Guru: {teacher.name}
          </button>
        </div>
      </div>

      {/* Tablet / Mobile / PID horizontal ordered menu strip */}
      <div className="lg:hidden border-t border-slate-100 px-3 py-1.5 flex items-center gap-1 overflow-x-auto bg-slate-50">
        {WORKSPACE_NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeTab(item.id)}
              className={`px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors ${
                isActive
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{item.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}

interface WorkspaceSidebarProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  counts?: {
    cpMateri?: number;
    assessment?: number;
    game?: number;
    folder?: number;
  };
  workflowReady?: WorkflowReadyState;
}

export function WorkspaceSidebar({
  activeTab,
  onChangeTab,
  counts,
  workflowReady,
}: WorkspaceSidebarProps) {
  const groups: { key: WorkspaceNavItem['group']; label: string }[] = [
    { key: 'utama', label: 'Utama' },
    { key: 'perangkat', label: 'Alur Perangkat (1–6)' },
    { key: 'evaluasi', label: 'Evaluasi, Game & Arsip' },
  ];

  const getCountFor = (id: ActiveTab): number | undefined => {
    if (!counts) return undefined;
    if (id === 'cp-materi' && counts.cpMateri) return counts.cpMateri;
    if (id === 'assessment' && counts.assessment) return counts.assessment;
    if (id === 'game' && counts.game) return counts.game;
    if (id === 'folder' && counts.folder) return counts.folder;
    return undefined;
  };

  const isStepReady = (id: ActiveTab): boolean => {
    if (!workflowReady) return false;
    switch (id) {
      case 'cp-materi':
        return Boolean(workflowReady.cpMateri);
      case 'tp-atp':
        return Boolean(workflowReady.tpAtp);
      case 'prota':
        return Boolean(workflowReady.prota);
      case 'prosem':
        return Boolean(workflowReady.prosem);
      case 'rpm':
        return Boolean(workflowReady.rpm);
      case 'agenda':
        return Boolean(workflowReady.agenda);
      default:
        return false;
    }
  };

  return (
    <aside className="no-print hidden lg:flex w-64 shrink-0 flex-col bg-white border-r border-slate-200 min-h-[calc(100vh-4rem)] p-4 gap-5">
      {groups.map((grp) => {
        const items = WORKSPACE_NAV_ITEMS.filter((i) => i.group === grp.key);
        return (
          <div key={grp.key} className="space-y-1">
            <div className="px-2.5 pb-1 text-[11px] font-semibold tracking-wide text-slate-400">
              {grp.label}
            </div>
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const badgeCount = getCountFor(item.id);
              const ready = isStepReady(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeTab(item.id)}
                  className={`w-full px-3 py-2.5 rounded-xl text-left text-sm flex items-center justify-between gap-2 transition-colors ${
                    isActive
                      ? 'bg-sky-50 text-sky-800 font-semibold border border-sky-200'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    {item.stepNum ? (
                      <span
                        className={`w-5 h-5 rounded-md text-[11px] font-mono font-bold flex items-center justify-center shrink-0 tabular-nums ${
                          isActive
                            ? 'bg-sky-600 text-white'
                            : ready
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {ready ? <Check className="w-3 h-3" /> : item.stepNum}
                      </span>
                    ) : (
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-sky-600' : 'text-slate-400'
                        }`}
                      />
                    )}
                    <span className="truncate">{item.label}</span>
                  </span>
                  {badgeCount !== undefined && badgeCount > 0 && (
                    <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md tabular-nums shrink-0">
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </aside>
  );
}
