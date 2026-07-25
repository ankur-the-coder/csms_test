import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6 pb-12">
      
      <!-- Top Title & Welcome Banner -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <h1 class="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
            Customer Success Dashboard
          </h1>
          <p class="text-xs md:text-sm text-slate-500 mt-1">
            Overview of all client activities, implementation health, and support operations.
          </p>
        </div>

        <div class="flex items-center gap-3">
          <button 
            (click)="navigateToImplementation()"
            class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
            </svg>
            <span>Go to Implementation Module</span>
          </button>
        </div>
      </div>

      <!-- Top Summary Metrics Grid (8 Cards) -->
      <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        
        <!-- Total Clients -->
        <div class="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-indigo-300 transition-all">
          <div class="flex items-center justify-between text-slate-500">
            <span class="text-[11px] font-bold uppercase tracking-wider">Total Clients</span>
            <div class="p-1.5 rounded-lg bg-teal-50 text-teal-600">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl font-extrabold text-slate-900">256</div>
            <span class="text-[10px] text-indigo-600 font-semibold cursor-pointer hover:underline">View all</span>
          </div>
        </div>

        <!-- Live Clients -->
        <div class="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-emerald-300 transition-all">
          <div class="flex items-center justify-between text-slate-500">
            <span class="text-[11px] font-bold uppercase tracking-wider">Live Clients</span>
            <div class="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl font-extrabold text-slate-900">198</div>
            <span class="text-[10px] text-emerald-600 font-bold">↗ 77.3%</span>
          </div>
        </div>

        <!-- Implementation Pending -->
        <div 
          (click)="navigateToImplementation()"
          class="bg-amber-50/50 hover:bg-amber-50 rounded-2xl p-4 border border-amber-200/80 shadow-xs flex flex-col justify-between cursor-pointer transition-all group"
        >
          <div class="flex items-center justify-between text-amber-700">
            <span class="text-[11px] font-bold uppercase tracking-wider">Impl. Pending</span>
            <div class="p-1.5 rounded-lg bg-amber-100 text-amber-600 group-hover:scale-110 transition-transform">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl font-extrabold text-amber-900">18</div>
            <span class="text-[10px] text-amber-700 font-bold group-hover:underline">Open module →</span>
          </div>
        </div>

        <!-- Training Pending -->
        <div class="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-purple-300 transition-all">
          <div class="flex items-center justify-between text-slate-500">
            <span class="text-[11px] font-bold uppercase tracking-wider">Training Pend.</span>
            <div class="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5z"/>
              </svg>
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl font-extrabold text-slate-900">22</div>
            <span class="text-[10px] text-purple-600 font-semibold cursor-pointer hover:underline">View</span>
          </div>
        </div>

        <!-- Support Open -->
        <div class="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-rose-300 transition-all">
          <div class="flex items-center justify-between text-slate-500">
            <span class="text-[11px] font-bold uppercase tracking-wider">Support Open</span>
            <div class="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"/>
              </svg>
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl font-extrabold text-slate-900">34</div>
            <span class="text-[10px] text-rose-600 font-semibold cursor-pointer hover:underline">View</span>
          </div>
        </div>

        <!-- Renewals This Mo -->
        <div class="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-all">
          <div class="flex items-center justify-between text-slate-500">
            <span class="text-[11px] font-bold uppercase tracking-wider">Renewals</span>
            <div class="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl font-extrabold text-slate-900">12</div>
            <span class="text-[10px] text-blue-600 font-semibold cursor-pointer hover:underline">View</span>
          </div>
        </div>

        <!-- Low Rating Clients -->
        <div class="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
          <div class="flex items-center justify-between text-slate-500">
            <span class="text-[11px] font-bold uppercase tracking-wider">Low Rating</span>
            <div class="p-1.5 rounded-lg bg-slate-100 text-slate-600">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
              </svg>
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl font-extrabold text-slate-900">0</div>
            <span class="text-[10px] text-slate-400 font-medium">No alerts</span>
          </div>
        </div>

        <!-- Escalated Clients -->
        <div class="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-red-300 transition-all">
          <div class="flex items-center justify-between text-slate-500">
            <span class="text-[11px] font-bold uppercase tracking-wider">Escalated</span>
            <div class="p-1.5 rounded-lg bg-red-50 text-red-600">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl font-extrabold text-red-600">4</div>
            <span class="text-[10px] text-red-600 font-semibold cursor-pointer hover:underline">View high priority</span>
          </div>
        </div>

      </div>

      <!-- Charts & Schedule Section (3 Columns) -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- Implementation Progress Overview Donut Widget -->
        <div class="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-bold text-slate-900">Implementation Progress Overview</h3>
              <button 
                (click)="navigateToImplementation()"
                class="text-xs font-semibold text-indigo-600 hover:underline"
              >
                Open Tracker →
              </button>
            </div>

            <!-- Simulated Donut Chart Visual -->
            <div class="flex items-center justify-center my-6 relative">
              <div class="w-40 h-40 rounded-full border-12 border-emerald-500 border-t-indigo-600 border-r-amber-500 border-l-slate-200 flex flex-col items-center justify-center shadow-inner">
                <span class="text-3xl font-extrabold text-slate-900">256</span>
                <span class="text-[11px] font-semibold text-slate-500">Total Clients</span>
              </div>
            </div>
          </div>

          <!-- Donut Legend Breakdown -->
          <div class="grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 text-xs font-semibold">
            <div class="flex items-center justify-between p-2 rounded-xl bg-slate-50">
              <span class="flex items-center gap-1.5 text-slate-700">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Completed
              </span>
              <span class="font-bold text-slate-900">136 (53%)</span>
            </div>
            <div class="flex items-center justify-between p-2 rounded-xl bg-slate-50">
              <span class="flex items-center gap-1.5 text-slate-700">
                <span class="w-2.5 h-2.5 rounded-full bg-indigo-600"></span> In Progress
              </span>
              <span class="font-bold text-slate-900">84 (33%)</span>
            </div>
            <div class="flex items-center justify-between p-2 rounded-xl bg-slate-50">
              <span class="flex items-center gap-1.5 text-slate-700">
                <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Pending
              </span>
              <span class="font-bold text-slate-900">18 (7%)</span>
            </div>
            <div class="flex items-center justify-between p-2 rounded-xl bg-slate-50">
              <span class="flex items-center gap-1.5 text-slate-700">
                <span class="w-2.5 h-2.5 rounded-full bg-slate-300"></span> Not Started
              </span>
              <span class="font-bold text-slate-900">18 (7%)</span>
            </div>
          </div>
        </div>

        <!-- Health Score Distribution Donut Widget -->
        <div class="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-bold text-slate-900">Health Score Distribution</h3>
              <span class="text-xs text-slate-400 font-medium">Updated today</span>
            </div>

            <!-- Simulated Donut Chart Visual -->
            <div class="flex items-center justify-center my-6 relative">
              <div class="w-40 h-40 rounded-full border-12 border-teal-500 border-t-emerald-400 border-r-amber-400 border-l-rose-500 flex flex-col items-center justify-center shadow-inner">
                <span class="text-3xl font-extrabold text-slate-900">256</span>
                <span class="text-[11px] font-semibold text-slate-500">Total Clients</span>
              </div>
            </div>
          </div>

          <!-- Health Legend Breakdown -->
          <div class="grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 text-xs font-semibold">
            <div class="flex items-center justify-between p-2 rounded-xl bg-slate-50">
              <span class="flex items-center gap-1.5 text-slate-700">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Excellent (80-100)
              </span>
              <span class="font-bold text-slate-900">120 (47%)</span>
            </div>
            <div class="flex items-center justify-between p-2 rounded-xl bg-slate-50">
              <span class="flex items-center gap-1.5 text-slate-700">
                <span class="w-2.5 h-2.5 rounded-full bg-teal-500"></span> Good (60-79)
              </span>
              <span class="font-bold text-slate-900">86 (34%)</span>
            </div>
            <div class="flex items-center justify-between p-2 rounded-xl bg-slate-50">
              <span class="flex items-center gap-1.5 text-slate-700">
                <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Average (40-59)
              </span>
              <span class="font-bold text-slate-900">32 (13%)</span>
            </div>
            <div class="flex items-center justify-between p-2 rounded-xl bg-slate-50">
              <span class="flex items-center gap-1.5 text-slate-700">
                <span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Poor (0-39)
              </span>
              <span class="font-bold text-slate-900">18 (6%)</span>
            </div>
          </div>
        </div>

        <!-- Today's Schedule Feed -->
        <div class="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-bold text-slate-900">Today's Schedule</h3>
              <span class="text-xs font-semibold text-indigo-600 cursor-pointer hover:underline">View Calendar</span>
            </div>

            <div class="space-y-3">
              <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                <div class="h-9 w-9 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold shrink-0 text-xs">
                  🎓
                </div>
                <div>
                  <div class="text-xs font-bold text-slate-900">Admin Training - ABC Industries</div>
                  <span class="text-[11px] text-slate-500 font-medium">10:00 AM - 11:30 AM · Online</span>
                </div>
              </div>

              <div 
                (click)="navigateToImplementation()"
                class="p-3 rounded-xl bg-indigo-50/60 border border-indigo-200/80 flex items-start gap-3 cursor-pointer hover:bg-indigo-50 transition-colors"
              >
                <div class="h-9 w-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0 text-xs shadow-xs">
                  🚀
                </div>
                <div>
                  <div class="text-xs font-bold text-indigo-950">Implementation Meeting - XYZ Ltd</div>
                  <span class="text-[11px] text-indigo-700 font-medium">12:00 PM - 01:00 PM · Impl. Checklist</span>
                </div>
              </div>

              <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                <div class="h-9 w-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0 text-xs">
                  📱
                </div>
                <div>
                  <div class="text-xs font-bold text-slate-900">Device Installation - PQR Solutions</div>
                  <span class="text-[11px] text-slate-500 font-medium">02:30 PM - 04:00 PM · Site Visit</span>
                </div>
              </div>

              <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                <div class="h-9 w-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold shrink-0 text-xs">
                  📋
                </div>
                <div>
                  <div class="text-xs font-bold text-slate-900">Monthly Review - LMN Group</div>
                  <span class="text-[11px] text-slate-500 font-medium">04:30 PM - 05:30 PM · Executive Review</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Quick Operations Metrics Strip (6 Cards) -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        <div class="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-[11px] font-semibold text-slate-500 block">Today's Trainings</span>
            <span class="text-xl font-extrabold text-slate-900">5</span>
          </div>
          <div class="h-8 w-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold">5</div>
        </div>

        <div class="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-[11px] font-semibold text-slate-500 block">Today's Meetings</span>
            <span class="text-xl font-extrabold text-slate-900">7</span>
          </div>
          <div class="h-8 w-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold">7</div>
        </div>

        <div class="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-[11px] font-semibold text-slate-500 block">Installations</span>
            <span class="text-xl font-extrabold text-slate-900">3</span>
          </div>
          <div class="h-8 w-8 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center text-xs font-bold">3</div>
        </div>

        <div class="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-[11px] font-semibold text-slate-500 block">Pending Documents</span>
            <span class="text-xl font-extrabold text-amber-600">14</span>
          </div>
          <div class="h-8 w-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-xs font-bold">14</div>
        </div>

        <div class="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-[11px] font-semibold text-slate-500 block">Pending Integrations</span>
            <span class="text-xl font-extrabold text-purple-600">9</span>
          </div>
          <div class="h-8 w-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-xs font-bold">9</div>
        </div>

        <div class="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-[11px] font-semibold text-slate-500 block">Overdue Tasks</span>
            <span class="text-xl font-extrabold text-rose-600">16</span>
          </div>
          <div class="h-8 w-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-xs font-bold">16</div>
        </div>

      </div>

    </div>
  `
})
export class DashboardComponent {

  constructor(private router: Router) {}

  navigateToImplementation() {
    this.router.navigate(['/implementation']);
  }
}
