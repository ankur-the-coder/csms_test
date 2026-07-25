import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface Feature {
  mod_id: number;
  name: string;
  description?: string;
}

export interface Module {
  tab_id: number;
  key: string;
  label: string;
  icon: string;
  features: Feature[];
}

export interface FeatureChecklistRow {
  approval_status: number; // 1 = approved, 0 = pending
  remark: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface Client {
  id: number;
  org_id: number;
  name: string;
  industry: string;
  onboarding_date: string;
  cs_lead: string;
  checklist: Record<number, FeatureChecklistRow>;
}

@Component({
  selector: 'app-implementation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6 pb-12">
      
      <!-- Top Banner & Executive Stats -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        <!-- Total Orgs Card -->
        <div class="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Clients</span>
            <div class="text-2xl font-extrabold text-slate-900 mt-1">{{ totalClients() }}</div>
            <div class="text-[11px] font-medium text-slate-500 mt-1">Active CS Accounts</div>
          </div>
          <div class="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
            </svg>
          </div>
        </div>

        <!-- Fully Implemented Orgs -->
        <div class="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed / Live</span>
            <div class="text-2xl font-extrabold text-emerald-600 mt-1">{{ completedClientsCount() }}</div>
            <div class="text-[11px] font-medium text-emerald-600 mt-1">100% Features Approved</div>
          </div>
          <div class="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
        </div>

        <!-- In Progress Orgs -->
        <div class="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">In Progress</span>
            <div class="text-2xl font-extrabold text-amber-600 mt-1">{{ inProgressClientsCount() }}</div>
            <div class="text-[11px] font-medium text-amber-600 mt-1">Active Onboarding</div>
          </div>
          <div class="h-12 w-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
        </div>

        <!-- Not Started -->
        <div class="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Not Started</span>
            <div class="text-2xl font-extrabold text-slate-400 mt-1">{{ pendingClientsCount() }}</div>
            <div class="text-[11px] font-medium text-slate-400 mt-1">Pending Kickoff</div>
          </div>
          <div class="h-12 w-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-200">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
            </svg>
          </div>
        </div>

        <!-- Global Feature Completion Rate -->
        <div class="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-lg shadow-indigo-900/20 flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-indigo-300 uppercase tracking-wider">Global Completion</span>
            <span class="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
              {{ overallCompletionPercentage() }}%
            </span>
          </div>
          <div class="mt-2">
            <div class="text-xl font-extrabold text-white">
              {{ totalApprovedFeaturesCount() }} / {{ totalPossibleFeaturesCount() }}
            </div>
            <div class="w-full bg-indigo-950/80 rounded-full h-2 mt-2 border border-indigo-800/50 overflow-hidden">
              <div 
                class="bg-gradient-to-r from-teal-400 to-cyan-300 h-2 rounded-full transition-all duration-500"
                [style.width.%]="overallCompletionPercentage()"
              ></div>
            </div>
          </div>
        </div>

      </div>

      <!-- Controls & Filter Bar -->
      <div class="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        <!-- Search & Filter Tabs -->
        <div class="flex flex-wrap items-center gap-2">
          <button 
            *ngFor="let tab of filterTabs"
            (click)="setFilterStatus(tab.id)"
            class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
            [ngClass]="{
              'bg-slate-900 text-white shadow-md shadow-slate-900/20': statusFilter() === tab.id,
              'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900': statusFilter() !== tab.id
            }"
          >
            {{ tab.label }}
            <span 
              class="ml-1.5 px-1.5 py-0.2 text-[10px] rounded-full"
              [ngClass]="{
                'bg-slate-700 text-white': statusFilter() === tab.id,
                'bg-slate-200 text-slate-700': statusFilter() !== tab.id
              }"
            >
              {{ tab.count }}
            </span>
          </button>
        </div>

        <!-- View Mode & Quick Info -->
        <div class="flex items-center gap-3">
          <div class="relative flex-1 md:w-64">
            <svg class="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input 
              type="text" 
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
              placeholder="Search organisation..."
              class="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <div class="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button 
              (click)="viewMode.set('grid')"
              class="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 transition-colors"
              [ngClass]="{'bg-white shadow-xs text-indigo-600 font-bold': viewMode() === 'grid'}"
              title="Grid View"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
              </svg>
            </button>
            <button 
              (click)="viewMode.set('table')"
              class="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 transition-colors"
              [ngClass]="{'bg-white shadow-xs text-indigo-600 font-bold': viewMode() === 'table'}"
              title="Table View"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
              </svg>
            </button>
          </div>
        </div>

      </div>

      <!-- Main Content: Organizations Grid View -->
      <div *ngIf="viewMode() === 'grid'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        <div 
          *ngFor="let client of filteredClients()"
          (click)="openClientDetails(client)"
          class="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-xl hover:border-indigo-300 transition-all duration-300 flex flex-col justify-between cursor-pointer group overflow-hidden relative"
        >
          <!-- Top Colored Edge Indicator based on progress -->
          <div 
            class="h-1.5 w-full transition-all"
            [ngClass]="{
              'bg-emerald-500': getClientApprovedCount(client) === totalFeaturesCount,
              'bg-amber-500': getClientApprovedCount(client) > 0 && getClientApprovedCount(client) < totalFeaturesCount,
              'bg-slate-300': getClientApprovedCount(client) === 0
            }"
          ></div>

          <div class="p-5">
            <!-- Header: Org Name & Org ID -->
            <div class="flex items-start justify-between gap-3">
              <div>
                <h3 class="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-2">
                  {{ client.name }}
                  <svg class="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                  </svg>
                </h3>
                <div class="flex items-center gap-2 mt-1">
                  <span class="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    org_id: {{ client.org_id }}
                  </span>
                  <span class="text-xs text-slate-500 font-medium">{{ client.industry }}</span>
                </div>
              </div>

              <!-- Completion Ring Badge -->
              <div 
                class="px-2.5 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5"
                [ngClass]="{
                  'bg-emerald-50 text-emerald-700 border border-emerald-200': getClientApprovedCount(client) === totalFeaturesCount,
                  'bg-amber-50 text-amber-700 border border-amber-200': getClientApprovedCount(client) > 0 && getClientApprovedCount(client) < totalFeaturesCount,
                  'bg-slate-100 text-slate-600 border border-slate-200': getClientApprovedCount(client) === 0
                }"
              >
                <span>{{ getClientProgressPercent(client) }}%</span>
              </div>
            </div>

            <!-- Progress Bar -->
            <div class="mt-4">
              <div class="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span class="text-slate-500">Implementation Progress</span>
                <span class="text-slate-800">{{ getClientApprovedCount(client) }} / {{ totalFeaturesCount }} features approved</span>
              </div>
              <div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                <div 
                  class="h-full rounded-full transition-all duration-500"
                  [ngClass]="{
                    'bg-emerald-500': getClientApprovedCount(client) === totalFeaturesCount,
                    'bg-gradient-to-r from-amber-500 to-emerald-500': getClientApprovedCount(client) > 0 && getClientApprovedCount(client) < totalFeaturesCount,
                    'bg-slate-300': getClientApprovedCount(client) === 0
                  }"
                  [style.width.%]="getClientProgressPercent(client)"
                ></div>
              </div>
            </div>

            <!-- Module Status Badges (Employee, Attendance, Leave, Payroll, Organization) -->
            <div class="mt-5 border-t border-slate-100 pt-4">
              <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Module Breakdown (tab_sts)</span>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                <div 
                  *ngFor="let mod of modules"
                  class="px-2 py-1 rounded-lg border text-[11px] font-semibold flex items-center justify-between"
                  [ngClass]="{
                    'bg-emerald-50/80 border-emerald-200 text-emerald-800': isModuleFullyApproved(client, mod),
                    'bg-amber-50/80 border-amber-200 text-amber-800': isModuleInProgress(client, mod),
                    'bg-slate-50 border-slate-200 text-slate-500': isModuleNotStarted(client, mod)
                  }"
                >
                  <span class="truncate">{{ mod.label }}</span>
                  <span class="font-bold text-[10px] ml-1">
                    {{ getModuleApprovedCount(client, mod) }}/{{ mod.features.length }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Footer Trigger Card -->
          <div class="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs">
            <div class="flex items-center gap-1.5 text-slate-500">
              <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
              <span>CS Lead: <strong class="text-slate-700">{{ client.cs_lead }}</strong></span>
            </div>

            <button 
              class="font-semibold text-indigo-600 group-hover:text-indigo-800 flex items-center gap-1 hover:underline"
            >
              <span>View Feature Status</span>
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
              </svg>
            </button>
          </div>

        </div>

      </div>

      <!-- Main Content: Organizations Table View -->
      <div *ngIf="viewMode() === 'table'" class="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase font-bold tracking-wider">
              <tr>
                <th class="px-5 py-3.5">Organisation</th>
                <th class="px-5 py-3.5">Org ID</th>
                <th class="px-5 py-3.5">CS Lead</th>
                <th class="px-5 py-3.5">Progress</th>
                <th class="px-5 py-3.5">Module Status</th>
                <th class="px-5 py-3.5 text-right w-44 whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-700 font-medium">
              <tr *ngFor="let client of filteredClients()" class="hover:bg-slate-50/80 transition-colors">
                <td class="px-5 py-4">
                  <div class="font-bold text-slate-900 text-base">{{ client.name }}</div>
                  <span class="text-xs text-slate-500">{{ client.industry }} · Onboarded {{ client.onboarding_date }}</span>
                </td>
                <td class="px-5 py-4">
                  <span class="font-mono text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {{ client.org_id }}
                  </span>
                </td>
                <td class="px-5 py-4 text-xs font-medium text-slate-800">
                  {{ client.cs_lead }}
                </td>
                <td class="px-5 py-4 w-56">
                  <div class="flex items-center justify-between text-xs font-bold mb-1">
                    <span>{{ getClientProgressPercent(client) }}%</span>
                    <span class="text-slate-500 text-[11px]">{{ getClientApprovedCount(client) }}/{{ totalFeaturesCount }} approved</span>
                  </div>
                  <div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div 
                      class="h-full rounded-full transition-all duration-300"
                      [ngClass]="{
                        'bg-emerald-500': getClientApprovedCount(client) === totalFeaturesCount,
                        'bg-amber-500': getClientApprovedCount(client) > 0 && getClientApprovedCount(client) < totalFeaturesCount,
                        'bg-slate-300': getClientApprovedCount(client) === 0
                      }"
                      [style.width.%]="getClientProgressPercent(client)"
                    ></div>
                  </div>
                </td>
                <td class="px-5 py-4">
                  <div class="flex flex-wrap gap-1">
                    <span 
                      *ngFor="let mod of modules"
                      class="px-2 py-0.5 text-[10px] font-bold rounded"
                      [ngClass]="{
                        'bg-emerald-100 text-emerald-800': isModuleFullyApproved(client, mod),
                        'bg-amber-100 text-amber-800': isModuleInProgress(client, mod),
                        'bg-slate-100 text-slate-500': isModuleNotStarted(client, mod)
                      }"
                    >
                      {{ mod.label }}: {{ getModuleApprovedCount(client, mod) }}/{{ mod.features.length }}
                    </span>
                  </div>
                </td>
                <td class="px-5 py-4 text-right whitespace-nowrap w-44">
                  <div class="flex items-center justify-end gap-2">
                    <button 
                      (click)="openClientDetails(client)"
                      class="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs border border-indigo-200/80 shadow-2xs transition-all inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <svg class="w-3.5 h-3.5 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      </svg>
                      <span>View Features</span>
                    </button>

                    <button 
                      (click)="openClientDetails(client)"
                      class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      title="More Actions"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- INTERACTIVE FEATURE STATUS MODAL / DRAWER ("Every Feature Status on Click") -->
      <!-- ========================================================================= -->
      <div 
        *ngIf="selectedClient()" 
        class="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex justify-end transition-opacity duration-300 animate-in fade-in"
      >
        <!-- Backdrop Click to Close -->
        <div class="absolute inset-0" (click)="closeClientDetails()"></div>

        <!-- Drawer Content Container -->
        <div class="relative w-full max-w-4xl bg-slate-50 h-full shadow-2xl flex flex-col z-10 border-l border-slate-200 animate-in slide-in-from-right duration-300">
          
          <!-- Drawer Header -->
          <div class="bg-white px-6 py-5 border-b border-slate-200 flex items-center justify-between sticky top-0 z-20 shadow-xs">
            <div class="flex items-center gap-4">
              <div class="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white font-extrabold text-xl flex items-center justify-center shadow-md shadow-indigo-600/20">
                {{ selectedClient()?.name?.charAt(0) }}
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h2 class="text-xl font-bold text-slate-900 leading-tight">
                    {{ selectedClient()?.name }}
                  </h2>
                  <span class="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    org_id: {{ selectedClient()?.org_id }}
                  </span>
                </div>
                <p class="text-xs text-slate-500 mt-0.5">
                  CS Manager: <span class="font-semibold text-slate-700">{{ selectedClient()?.cs_lead }}</span> · Industry: {{ selectedClient()?.industry }}
                </p>
              </div>
            </div>

            <!-- Header Action Buttons -->
            <div class="flex items-center gap-2">
              <button 
                (click)="markAllApproved(selectedClient()!)"
                class="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs border border-emerald-200 transition-colors flex items-center gap-1.5"
                title="Approve all features for this client"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                </svg>
                <span>Approve All</span>
              </button>

              <button 
                (click)="closeClientDetails()"
                class="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Close"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Drawer Overall Progress Banner -->
          <div class="bg-indigo-900 text-white px-6 py-4 flex items-center justify-between border-b border-indigo-800">
            <div>
              <span class="text-xs font-bold text-indigo-300 uppercase tracking-wider">Overall Implementation Status</span>
              <div class="text-lg font-bold mt-0.5">
                {{ getClientApprovedCount(selectedClient()!) }} / {{ totalFeaturesCount }} Features Approved
              </div>
            </div>

            <div class="flex items-center gap-4">
              <div class="w-48 bg-indigo-950/80 rounded-full h-3 border border-indigo-700 overflow-hidden">
                <div 
                  class="bg-gradient-to-r from-teal-400 to-emerald-400 h-3 rounded-full transition-all duration-300"
                  [style.width.%]="getClientProgressPercent(selectedClient()!)"
                ></div>
              </div>
              <span class="text-xl font-extrabold text-teal-300">
                {{ getClientProgressPercent(selectedClient()!) }}%
              </span>
            </div>
          </div>

          <!-- Module Filtering Tabs Inside Drawer -->
          <div class="bg-white px-6 py-3 border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
            <button 
              (click)="selectedModuleTab.set('all')"
              class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0"
              [ngClass]="{
                'bg-indigo-600 text-white shadow-sm': selectedModuleTab() === 'all',
                'bg-slate-100 text-slate-600 hover:bg-slate-200': selectedModuleTab() !== 'all'
              }"
            >
              All Modules ({{ totalFeaturesCount }})
            </button>

            <button 
              *ngFor="let mod of modules"
              (click)="selectedModuleTab.set(mod.key)"
              class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5"
              [ngClass]="{
                'bg-indigo-600 text-white shadow-sm': selectedModuleTab() === mod.key,
                'bg-slate-100 text-slate-600 hover:bg-slate-200': selectedModuleTab() !== mod.key
              }"
            >
              <span>{{ mod.label }}</span>
              <span 
                class="px-1.5 py-0.2 text-[10px] rounded-full font-bold"
                [ngClass]="{
                  'bg-indigo-800 text-white': selectedModuleTab() === mod.key,
                  'bg-slate-200 text-slate-700': selectedModuleTab() !== mod.key
                }"
              >
                {{ getModuleApprovedCount(selectedClient()!, mod) }}/{{ mod.features.length }}
              </span>
            </button>
          </div>

          <!-- Feature Status Master List / Accordions -->
          <div class="flex-1 overflow-y-auto p-6 space-y-6">
            
            <div 
              *ngFor="let mod of getDisplayModules()"
              class="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden"
            >
              <!-- Module Header -->
              <div class="bg-slate-50/80 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center font-bold text-xs">
                    {{ mod.tab_id }}
                  </div>
                  <div>
                    <h4 class="font-bold text-slate-900 text-sm leading-tight">{{ mod.label }} Module</h4>
                    <span class="text-[11px] text-slate-500">tab_id {{ mod.tab_id }} · {{ mod.features.length }} total features</span>
                  </div>
                </div>

                <!-- Module tab_sts Badge -->
                <div 
                  class="px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5"
                  [ngClass]="{
                    'bg-emerald-100 text-emerald-800 border border-emerald-300': isModuleFullyApproved(selectedClient()!, mod),
                    'bg-amber-100 text-amber-800 border border-amber-300': isModuleInProgress(selectedClient()!, mod),
                    'bg-slate-100 text-slate-600 border border-slate-300': isModuleNotStarted(selectedClient()!, mod)
                  }"
                >
                  <span class="w-2 h-2 rounded-full" [ngClass]="{
                    'bg-emerald-500': isModuleFullyApproved(selectedClient()!, mod),
                    'bg-amber-500': isModuleInProgress(selectedClient()!, mod),
                    'bg-slate-400': isModuleNotStarted(selectedClient()!, mod)
                  }"></span>
                  <span>
                    {{ isModuleFullyApproved(selectedClient()!, mod) ? 'Complete · tab_sts 1' : 'In Progress · tab_sts 0' }}
                  </span>
                  <span class="font-bold">({{ getModuleApprovedCount(selectedClient()!, mod) }}/{{ mod.features.length }})</span>
                </div>
              </div>

              <!-- Feature Checklist Table -->
              <div class="divide-y divide-slate-100">
                <table class="w-full text-left text-xs">
                  <thead class="bg-slate-100/60 text-slate-500 uppercase font-bold tracking-wider text-[10px]">
                    <tr>
                      <th class="px-5 py-2.5 w-16">mod_id</th>
                      <th class="px-5 py-2.5">Feature Master</th>
                      <th class="px-5 py-2.5 w-36">Status</th>
                      <th class="px-5 py-2.5">Remarks / CS Notes</th>
                      <th class="px-5 py-2.5 w-32">Started</th>
                      <th class="px-5 py-2.5 w-32">Completed</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 text-slate-700">
                    <tr *ngFor="let feat of mod.features" class="hover:bg-slate-50/60 transition-colors">
                      <!-- mod_id -->
                      <td class="px-5 py-3 font-mono font-semibold text-slate-500">
                        {{ feat.mod_id }}
                      </td>

                      <!-- Feature Name -->
                      <td class="px-5 py-3">
                        <div class="font-bold text-slate-900 text-xs">{{ feat.name }}</div>
                      </td>

                      <!-- Status Toggle Button -->
                      <td class="px-5 py-3">
                        <button 
                          (click)="toggleFeatureStatus(selectedClient()!, feat.mod_id)"
                          class="px-3 py-1.5 rounded-full font-bold text-xs inline-flex items-center gap-1.5 transition-all shadow-2xs"
                          [ngClass]="{
                            'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20': selectedClient()?.checklist?.[feat.mod_id]?.approval_status === 1,
                            'bg-slate-200 text-slate-700 hover:bg-slate-300': selectedClient()?.checklist?.[feat.mod_id]?.approval_status === 0
                          }"
                        >
                          <svg *ngIf="selectedClient()?.checklist?.[feat.mod_id]?.approval_status === 1" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
                          </svg>
                          <svg *ngIf="selectedClient()?.checklist?.[feat.mod_id]?.approval_status === 0" class="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
                          </svg>
                          <span>{{ selectedClient()?.checklist?.[feat.mod_id]?.approval_status === 1 ? 'Approved' : 'Pending' }}</span>
                        </button>
                      </td>

                      <!-- Remark Input -->
                      <td class="px-5 py-3">
                        <input 
                          type="text"
                          [value]="selectedClient()?.checklist?.[feat.mod_id]?.remark || ''"
                          (input)="updateRemark(selectedClient()!, feat.mod_id, $event)"
                          placeholder="Add remark..."
                          class="w-full bg-slate-50 hover:bg-white focus:bg-white text-xs px-2.5 py-1 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none transition-colors"
                        />
                      </td>

                      <!-- Started At -->
                      <td class="px-5 py-3 text-slate-500 font-mono text-[11px]">
                        {{ selectedClient()?.checklist?.[feat.mod_id]?.started_at || '—' }}
                      </td>

                      <!-- Completed At -->
                      <td class="px-5 py-3 text-slate-500 font-mono text-[11px]">
                        {{ selectedClient()?.checklist?.[feat.mod_id]?.completed_at || '—' }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          <!-- Drawer Footer -->
          <div class="bg-white px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <span class="text-xs text-slate-500">
              Changes auto-sync to CSMS database in real-time.
            </span>
            <button 
              (click)="closeClientDetails()"
              class="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-sm transition-all"
            >
              Done & Close
            </button>
          </div>

        </div>
      </div>

    </div>
  `
})
export class ImplementationComponent {
  
  // Master Modules Data Schema matching implementation_module.jsx
  readonly modules: Module[] = [
    {
      tab_id: 1,
      key: 'employee',
      label: 'Employee',
      icon: 'users',
      features: [{ mod_id: 64, name: 'Onboard Employees' }]
    },
    {
      tab_id: 2,
      key: 'attendance',
      label: 'Attendance',
      icon: 'calendar',
      features: [
        { mod_id: 42, name: 'Shift' },
        { mod_id: 185, name: 'Projects' },
        { mod_id: 186, name: 'Tasks' },
        { mod_id: 187, name: 'Settings of Timesheet' },
        { mod_id: 502, name: 'Regularization Settings' }
      ]
    },
    {
      tab_id: 3,
      key: 'leave',
      label: 'Leave',
      icon: 'leave',
      features: [
        { mod_id: 31, name: 'Leave Type Settings' },
        { mod_id: 193, name: 'Import Leave Balance' }
      ]
    },
    {
      tab_id: 4,
      key: 'payroll',
      label: 'Payroll',
      icon: 'bank',
      features: [
        { mod_id: 41, name: 'Salary Heads' },
        { mod_id: 455, name: 'Payroll Heads' },
        { mod_id: 474, name: 'EPF Settings' },
        { mod_id: 478, name: 'ESIC Settings' },
        { mod_id: 485, name: 'Professional Tax Settings' },
        { mod_id: 509, name: 'Labour Welfare Fund' }
      ]
    },
    {
      tab_id: 5,
      key: 'organization',
      label: 'Organization',
      icon: 'network',
      features: [
        { mod_id: 12, name: 'Departments' },
        { mod_id: 13, name: 'Designations' },
        { mod_id: 14, name: 'Divisions' },
        { mod_id: 29, name: 'Holidays' },
        { mod_id: 32, name: 'Locations' },
        { mod_id: 35, name: 'Company Details' },
        { mod_id: 54, name: 'Company Policy' },
        { mod_id: 145, name: 'Hierarchy' }
      ]
    }
  ];

  // Helper Total Features count per organization (22)
  readonly totalFeaturesCount = this.modules.reduce((acc, m) => acc + m.features.length, 0);

  // Clients Seed State Signal
  clients = signal<Client[]>(this.buildSeedClients());

  // UI Filters State
  searchQuery = signal<string>('');
  statusFilter = signal<string>('all'); // all, complete, in_progress, pending
  viewMode = signal<'grid' | 'table'>('grid');

  // Drawer / Selected Client State
  selectedClient = signal<Client | null>(null);
  selectedModuleTab = signal<string>('all');

  // Filter Tabs Config
  get filterTabs() {
    return [
      { id: 'all', label: 'All Organisations', count: this.clients().length },
      { id: 'complete', label: 'Completed (100%)', count: this.completedClientsCount() },
      { id: 'in_progress', label: 'In Progress', count: this.inProgressClientsCount() },
      { id: 'pending', label: 'Not Started', count: this.pendingClientsCount() }
    ];
  }

  // Filtered Clients Computed
  filteredClients = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const sf = this.statusFilter();

    return this.clients().filter(c => {
      const matchSearch = c.name.toLowerCase().includes(q) || c.org_id.toString().includes(q) || c.cs_lead.toLowerCase().includes(q);
      if (!matchSearch) return false;

      const approvedCount = this.getClientApprovedCount(c);
      if (sf === 'complete') return approvedCount === this.totalFeaturesCount;
      if (sf === 'in_progress') return approvedCount > 0 && approvedCount < this.totalFeaturesCount;
      if (sf === 'pending') return approvedCount === 0;

      return true;
    });
  });

  // Summary Metrics Computations
  totalClients = computed(() => this.clients().length);
  
  completedClientsCount = computed(() => 
    this.clients().filter(c => this.getClientApprovedCount(c) === this.totalFeaturesCount).length
  );

  inProgressClientsCount = computed(() => 
    this.clients().filter(c => {
      const count = this.getClientApprovedCount(c);
      return count > 0 && count < this.totalFeaturesCount;
    }).length
  );

  pendingClientsCount = computed(() => 
    this.clients().filter(c => this.getClientApprovedCount(c) === 0).length
  );

  totalPossibleFeaturesCount = computed(() => this.clients().length * this.totalFeaturesCount);

  totalApprovedFeaturesCount = computed(() => 
    this.clients().reduce((sum, c) => sum + this.getClientApprovedCount(c), 0)
  );

  overallCompletionPercentage = computed(() => {
    const total = this.totalPossibleFeaturesCount();
    if (total === 0) return 0;
    return Math.round((this.totalApprovedFeaturesCount() / total) * 100);
  });

  // Seed Initial Clients
  private buildSeedClients(): Client[] {
    const stamp = (hoursAgo = 0) => {
      const d = new Date(Date.now() - hoursAgo * 3600 * 1000);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    const buildChecklist = (approvedModIds: number[]) => {
      const map: Record<number, FeatureChecklistRow> = {};
      this.modules.forEach(m => m.features.forEach(f => {
        const isApproved = approvedModIds.includes(f.mod_id);
        map[f.mod_id] = {
          approval_status: isApproved ? 1 : 0,
          remark: isApproved ? 'Verified & approved' : '',
          started_at: isApproved ? stamp(24) : null,
          completed_at: isApproved ? stamp(2) : null
        };
      }));
      return map;
    };

    const allModIds = this.modules.flatMap(m => m.features.map(f => f.mod_id));

    return [
      {
        id: 1,
        org_id: 478190,
        name: 'ABC Industries',
        industry: 'Manufacturing',
        onboarding_date: '10 Jan 2026',
        cs_lead: 'Neha Singh',
        checklist: buildChecklist([64, 42, 12, 13, 35, 41, 455, 31, 185])
      },
      {
        id: 2,
        org_id: 480581,
        name: 'XYZ Ltd',
        industry: 'Technology & SaaS',
        onboarding_date: '15 Jan 2026',
        cs_lead: 'Amit Sharma',
        checklist: buildChecklist([64, 41, 455, 474])
      },
      {
        id: 3,
        org_id: 480606,
        name: 'PQR Solutions',
        industry: 'Logistics',
        onboarding_date: '20 Jan 2026',
        cs_lead: 'Rahul Verma',
        checklist: buildChecklist([])
      },
      {
        id: 4,
        org_id: 469812,
        name: 'LMN Group',
        industry: 'Healthcare',
        onboarding_date: '02 Jan 2026',
        cs_lead: 'Priya Patel',
        checklist: buildChecklist([64, 42, 185, 186, 31, 193, 12, 13, 14, 32, 41, 455, 474, 478, 485])
      },
      {
        id: 5,
        org_id: 448120,
        name: 'Kestrel Logistics',
        industry: 'Supply Chain',
        onboarding_date: '01 Dec 2025',
        cs_lead: 'Vikram Singh',
        checklist: buildChecklist(allModIds)
      },
      {
        id: 6,
        org_id: 492100,
        name: 'Apex Fintech',
        industry: 'Financial Services',
        onboarding_date: '18 Jan 2026',
        cs_lead: 'Ananya Roy',
        checklist: buildChecklist([64, 42, 12, 13, 35, 31, 41, 455])
      }
    ];
  }

  // Client Helper Methods
  getClientApprovedCount(client: Client): number {
    if (!client || !client.checklist) return 0;
    return Object.values(client.checklist).filter(row => row.approval_status === 1).length;
  }

  getClientProgressPercent(client: Client): number {
    return Math.round((this.getClientApprovedCount(client) / this.totalFeaturesCount) * 100);
  }

  getModuleApprovedCount(client: Client, mod: Module): number {
    if (!client || !client.checklist) return 0;
    return mod.features.filter(f => client.checklist[f.mod_id]?.approval_status === 1).length;
  }

  isModuleFullyApproved(client: Client, mod: Module): boolean {
    return this.getModuleApprovedCount(client, mod) === mod.features.length;
  }

  isModuleInProgress(client: Client, mod: Module): boolean {
    const count = this.getModuleApprovedCount(client, mod);
    return count > 0 && count < mod.features.length;
  }

  isModuleNotStarted(client: Client, mod: Module): boolean {
    return this.getModuleApprovedCount(client, mod) === 0;
  }

  setFilterStatus(status: string) {
    this.statusFilter.set(status);
  }

  // Drawer / Interactive Handlers
  openClientDetails(client: Client) {
    this.selectedClient.set({ ...client });
    this.selectedModuleTab.set('all');
  }

  closeClientDetails() {
    this.selectedClient.set(null);
  }

  getDisplayModules(): Module[] {
    const tabKey = this.selectedModuleTab();
    if (tabKey === 'all') return this.modules;
    return this.modules.filter(m => m.key === tabKey);
  }

  toggleFeatureStatus(client: Client, modId: number) {
    const currentStatus = client.checklist[modId]?.approval_status || 0;
    const nextStatus = currentStatus === 1 ? 0 : 1;
    const stamp = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

    const updatedChecklist = {
      ...client.checklist,
      [modId]: {
        ...client.checklist[modId],
        approval_status: nextStatus,
        started_at: nextStatus === 1 ? client.checklist[modId]?.started_at || stamp : null,
        completed_at: nextStatus === 1 ? stamp : null
      }
    };

    const updatedClient = { ...client, checklist: updatedChecklist };

    // Update state signals
    this.clients.update(list => list.map(c => c.id === client.id ? updatedClient : c));
    if (this.selectedClient()?.id === client.id) {
      this.selectedClient.set(updatedClient);
    }
  }

  updateRemark(client: Client, modId: number, event: Event) {
    const remark = (event.target as HTMLInputElement).value;
    
    const updatedChecklist = {
      ...client.checklist,
      [modId]: {
        ...client.checklist[modId],
        remark
      }
    };

    const updatedClient = { ...client, checklist: updatedChecklist };

    this.clients.update(list => list.map(c => c.id === client.id ? updatedClient : c));
    if (this.selectedClient()?.id === client.id) {
      this.selectedClient.set(updatedClient);
    }
  }

  markAllApproved(client: Client) {
    const stamp = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    const updatedChecklist = { ...client.checklist };

    this.modules.forEach(m => m.features.forEach(f => {
      updatedChecklist[f.mod_id] = {
        approval_status: 1,
        remark: updatedChecklist[f.mod_id]?.remark || 'Batch approved by CS Manager',
        started_at: updatedChecklist[f.mod_id]?.started_at || stamp,
        completed_at: stamp
      };
    }));

    const updatedClient = { ...client, checklist: updatedChecklist };
    this.clients.update(list => list.map(c => c.id === client.id ? updatedClient : c));
    this.selectedClient.set(updatedClient);
  }
}
