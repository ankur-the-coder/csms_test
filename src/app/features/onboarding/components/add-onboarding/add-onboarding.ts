
import { Component } from '@angular/core';

@Component({
  selector: 'app-add-onboarding',
  imports: [],
  templateUrl: './add-onboarding.html',
  styleUrl: './add-onboarding.css',
})
export class AddOnboarding {}

import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-add-onboarding',
  imports: [CommonModule, FormsModule],
  templateUrl: './add-onboarding.html',
  styleUrl: './add-onboarding.css',
})
export class AddOnboarding {// Theme state
  isDarkMode = false;

  // View state
  activeView = 'dash';
  dashSubView = 'list'; // 'list' | 'kanban' | 'calendar' | 'split'
  activeRole = 'csm'; // 'csm' | 'impl' | 'trainer' | 'admin' | 'mgmt' | 'customer'

  // Modals & Panels
  isModalOpen = false;
  isCmdOpen = false;
  isNCOpen = false;
  isAiOpen = false;
  isDrawerOpen = false;
  isShortcutsOpen = false;

  // Search & Filter
  searchQuery = '';
  selectedStageFilter = 'all';

  // Quick Info Badges per Role
  roleBadges: Record<string, { icon: string; name: string; desc: string; roleLabel: string }> = {
    csm: { icon: '👤', name: 'CSM Mode', desc: 'Customer Success Manager', roleLabel: 'Customer Success' },
    impl: { icon: '⚙️', name: 'Implementation Mode', desc: 'Implementation Specialist', roleLabel: 'Implementation' },
    trainer: { icon: '🎓', name: 'Trainer Mode', desc: 'Training Lead', roleLabel: 'Training Specialist' },
    admin: { icon: '🛡️', name: 'Admin Mode', desc: 'System Administrator', roleLabel: 'Administrator' },
    mgmt: { icon: '📊', name: 'Management Mode', desc: 'Executive / Lead View', roleLabel: 'Management' },
    customer: { icon: '🏢', name: 'Customer Portal', desc: 'Customer View', roleLabel: 'Customer' },
  };

  // Sample Data for Table & Split View
  onboardings = [
    { id: 'ONB-2026-041', name: 'Northwind Logistics', av: 'NL', bg: '#1B6E58', stage: 6, stageName: 'Training', stageClass: 'stage-6', progress: 68, sla: '⏱ 14d', slaClass: 'sla-warn', owner: 'Priya Sharma', targetDate: 'Aug 8, 2026', status: 'On Track', statusClass: 'status-on-track' },
    { id: 'ONB-2026-042', name: 'Helios Energy', av: 'HE', bg: '#B07508', stage: 4, stageName: 'Configuration', stageClass: 'stage-4', progress: 45, sla: '⏱ 27d', slaClass: 'sla-warn', owner: 'Daniel Okafor', targetDate: 'Aug 21, 2026', status: 'On Track', statusClass: 'status-on-track' },
    { id: 'ONB-2026-046', name: 'BlueRiver Foods', av: 'BF', bg: '#3B82F6', stage: 3, stageName: 'Requirements', stageClass: 'stage-3', progress: 30, sla: '⏱ 39d', slaClass: 'sla-warn', owner: 'Priya Sharma', targetDate: 'Sep 2, 2026', status: 'At Risk', statusClass: 'status-at-risk' },
    { id: 'ONB-2026-048', name: 'Vertex Retail Group', av: 'VR', bg: '#145247', stage: 7, stageName: 'UAT / Readiness', stageClass: 'stage-7', progress: 82, sla: '⏱ 5d', slaClass: 'sla-warn', owner: 'Amara Diallo', targetDate: 'Jul 30, 2026', status: 'On Track', statusClass: 'status-on-track' },
    { id: 'ONB-2026-044', name: 'Orion Healthcare', av: 'OH', bg: '#B03A3E', stage: 5, stageName: 'Data Migration', stageClass: 'stage-5', progress: 52, sla: '⚠ 3d', slaClass: 'sla-danger', owner: 'Daniel Okafor', targetDate: 'Jul 22, 2026', status: 'Delayed', statusClass: 'status-delayed' },
    { id: 'ONB-2026-049', name: 'Cascade Freight', av: 'CF', bg: '#6B7280', stage: 1, stageName: 'Initiated', stageClass: 'stage-1', progress: 10, sla: '⏱ 52d', slaClass: 'sla-warn', owner: 'Amara Diallo', targetDate: 'Sep 18, 2026', status: 'On Track', statusClass: 'status-on-track' },
    { id: 'ONB-2026-050', name: 'Maple & Main Retail', av: 'MM', bg: '#0D9488', stage: 8, stageName: 'Go-Live', stageClass: 'stage-8', progress: 95, sla: 'today', slaClass: 'sla-today', owner: 'Priya Sharma', targetDate: 'Jul 27, 2026', status: 'On Track', statusClass: 'status-on-track' }
  ];

  selectedSplitItem = this.onboardings[0];

  // Drawer / Detail State
  drawerItem = this.onboardings[0];

  // Go-Live Signature state
  signatureText = '';
  goLiveComplete = false;

  // Toast System
  toasts: Array<{ id: number; message: string; type: string; isOut?: boolean }> = [];
  toastCounter = 0;

  // Toggle Theme
  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    const htmlEl = document.documentElement;
    if (this.isDarkMode) {
      htmlEl.setAttribute('data-theme', 'dark');
    } else {
      htmlEl.removeAttribute('data-theme');
    }
  }

  // Navigation
  go(view: string) {
    this.activeView = view;
  }

  // Set Role
  setRole(role: string) {
    this.activeRole = role;
    this.showToast(`Switched to ${this.roleBadges[role].name}`, 'info');
  }

  // Modals & Triggers
  openModal() { this.isModalOpen = true; }
  closeModal() { this.isModalOpen = false; }

  openCmd() { this.isCmdOpen = true; }
  closeCmd() { this.isCmdOpen = false; }

  toggleNC(event?: Event) {
    if (event) event.stopPropagation();
    this.isNCOpen = !this.isNCOpen;
  }

  toggleAi() { this.isAiOpen = !this.isAiOpen; }
  openShortcuts() { this.isShortcutsOpen = true; }
  closeShortcuts() { this.isShortcutsOpen = false; }

  // Dynamic Tasks List for active drawer record
  drawerTasks = [
    { id: 1, title: 'Configure roles & permissions', owner: 'Daniel Okafor', due: 'Jul 22', done: true },
    { id: 2, title: 'Set up ERP integration (SAP)', owner: 'Daniel Okafor', due: 'Jul 21', done: true },
    { id: 3, title: 'Apply branding & email templates', owner: 'Daniel Okafor', due: 'Jul 20', done: true },
    { id: 4, title: 'Import legacy data', owner: 'Daniel Okafor', due: 'Jul 23', done: true },
    { id: 5, title: 'Schedule admin & end-user sessions', owner: 'Mia Chen', due: 'Jul 24', done: true },
    { id: 6, title: 'Deliver end-user training · Session 1', owner: 'Mia Chen', due: 'Jul 29', done: false },
    { id: 7, title: 'Share training materials & recordings', owner: 'Mia Chen', due: 'Jul 30', done: false },
    { id: 8, title: 'Collect attendance roster & feedback', owner: 'Mia Chen', due: 'Jul 22', done: false, isOverdue: true }
  ];

  // Drawer Edit Form Model
  editModel: any = {};

  // Stage labels
  stagesList = [
    { num: 1, name: 'Initiated' },
    { num: 2, name: 'Kickoff' },
    { num: 3, name: 'Requirements' },
    { num: 4, name: 'Configuration' },
    { num: 5, name: 'Data Migration' },
    { num: 6, name: 'Training' },
    { num: 7, name: 'UAT / Readiness' },
    { num: 8, name: 'Go-Live' },
    { num: 9, name: 'Handover' }
  ];

  // Open Drawer and copy state
  openDrawer(item?: any) {
    if (item) {
      this.drawerItem = item;
    }
    this.editModel = {
      ...this.drawerItem,
      contractDate: '2026-06-12',
      targetDateIso: '2026-08-08',
      actualDateIso: '2026-07-02',
      plan: 'Enterprise',
      template: 'Enterprise (45 days)',
      contactName: 'Sarah Rodriguez',
      contactEmail: 'sarah@northwind.com',
      contactRole: 'Project Lead',
      contactPhone: '+1 (555) 234-5678',
      csm: 'Priya Sharma',
      implOwner: 'Daniel Okafor',
      trainer: 'Mia Chen',
      notes: 'Customer is highly engaged. Sarah Rodriguez is the primary POC.'
    };
    this.isDrawerOpen = true;
  }

  closeDrawer() {
    this.isDrawerOpen = false;
  }

  // Interactively change current stage in drawer
  setDrawerStage(stageNum: number) {
    const stageObj = this.stagesList.find(s => s.num === stageNum);
    if (stageObj) {
      this.editModel.stage = stageNum;
      this.editModel.stageName = stageObj.name;
      this.editModel.stageClass = `stage-${stageNum}`;
      this.showToast(`Stage updated to ${stageNum} · ${stageObj.name}`, 'info');
    }
  }

  // Toggle task checkbox
  toggleTask(task: any) {
    task.done = !task.done;
  }

  // Add new task dynamically
  addNewTask() {
    const newTask = {
      id: Date.now(),
      title: 'New Onboarding Action Item',
      owner: this.editModel.implOwner || 'Daniel Okafor',
      due: 'Aug 05',
      done: false
    };
    this.drawerTasks.push(newTask);
    this.showToast('✓ Task added to checklist', 'info');
  }

  // Flag at Risk
  flagRisk() {
    this.editModel.status = 'At Risk';
    this.editModel.statusClass = 'status-at-risk';
    this.showToast('🚩 Account flagged as At Risk!', 'warn');
  }

  // Save changes back to active onboarding item
  saveDrawer() {
    const idx = this.onboardings.findIndex(o => o.id === this.editModel.id);
    if (idx !== -1) {
      this.onboardings[idx] = {
        ...this.onboardings[idx],
        name: this.editModel.name,
        stage: this.editModel.stage,
        stageName: this.editModel.stageName,
        stageClass: `stage-${this.editModel.stage}`,
        owner: this.editModel.csm,
        status: this.editModel.status,
        statusClass: this.editModel.status === 'At Risk' ? 'status-at-risk' : (this.editModel.status === 'Delayed' ? 'status-delayed' : 'status-on-track')
      };
    }
    this.drawerItem = { ...this.editModel };
    this.isDrawerOpen = false;
    this.showToast('💾 Record changes saved successfully!', 'info');
  }

  // Filter stage
  setStageFilter(filter: string) {
    this.selectedStageFilter = filter;
  }

  get filteredOnboardings() {
    if (this.selectedStageFilter === 'all') {
      return this.onboardings;
    }
    const stageNum = parseInt(this.selectedStageFilter, 10);
    return this.onboardings.filter(item => item.stage === stageNum);
  }

  showSplitDetail(item: any) {
    this.selectedSplitItem = item;
  }

  // Toast Action
  showToast(message: string, type: 'info' | 'warn' | 'error' = 'info') {
    const id = ++this.toastCounter;
    const toastObj = { id, message, type, isOut: false };
    this.toasts.push(toastObj);

    setTimeout(() => {
      toastObj.isOut = true;
      setTimeout(() => {
        this.toasts = this.toasts.filter(t => t.id !== id);
      }, 300);
    }, 3000);
  }

  markAllRead() {
    this.showToast('All notifications marked as read', 'info');
  }

  confirmGL() {
    this.goLiveComplete = true;
    this.showToast('🚀 Go-Live confirmed successfully!', 'info');
  }
}

