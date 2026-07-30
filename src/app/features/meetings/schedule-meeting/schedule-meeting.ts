import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MeetingService, Organization } from '../meetings.service';

@Component({
  selector: 'app-schedule-meeting',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './schedule-meeting.html',
  styleUrls: ['./schedule-meeting.css']
})
export class ScheduleMeeting implements OnInit {
  newMeeting: any = {
    title: '',
    orgId: null,
    customer: '',
    type: '',
    duration: '1 hour',
    date: '',
    time: '',
    priority: 'Medium',
    host: '',
    link: '',
    description: ''
  };

  organizations: Organization[] = [];
  loadingOrganizations = false;

  meetingTypesList = ['Kickoff', 'Review', 'Training', 'QBR', 'Go Live', 'Renewal'];
  
  hostType: 'lead' | 'support' | '' = '';
  hosts: string[] = [];
  loadingHosts = false;

  constructor(private router: Router, private meetingService: MeetingService) {}

  ngOnInit(): void {
    this.fetchOrganizations();
  }

  fetchOrganizations(): void {
    this.loadingOrganizations = true;
    this.meetingService.getOrganizations().subscribe({
      next: (orgs) => {
        this.organizations = orgs;
        this.loadingOrganizations = false;
      },
      error: (err) => {
        console.error('Failed to fetch organizations', err);
        this.loadingOrganizations = false;
      }
    });
  }

  onOrganizationSelect(orgIdValue: string): void {
    const orgId = Number(orgIdValue);
    const org = this.organizations.find(o => o.orgId === orgId);
    this.newMeeting.orgId = org ? org.orgId : null;
    this.newMeeting.customer = org ? org.name : '';
  }

  onHostTypeChange(type: 'lead' | 'support'): void {
    this.hostType = type;
    this.newMeeting.host = '';
    this.hosts = [];
    this.loadingHosts = true;

    if (type === 'lead') {
      this.meetingService.getLeadOwners().subscribe({
        next: (owners) => {
          this.hosts = owners;
          this.loadingHosts = false;
        },
        error: (err) => {
          console.error('Failed to fetch lead owners', err);
          this.loadingHosts = false;
        }
      });
    } else if (type === 'support') {
      this.meetingService.getSupportOwners().subscribe({
        next: (owners) => {
          this.hosts = owners;
          this.loadingHosts = false;
        },
        error: (err) => {
          console.error('Failed to fetch support owners', err);
          this.loadingHosts = false;
        }
      });
    }
  }

  getDefaultAttendees(): string[] {
    return ['Client Contact', 'Project Manager'];
  }

  goBack(): void {
    this.router.navigate(['/meetings']);
  }

  saveAsDraft(): void {
    console.log('Saved as draft', this.newMeeting);
    this.goBack();
  }

  saveMeeting(): void {
    console.log('Scheduled meeting', this.newMeeting);
    this.goBack();
  }

  isFormValid(): boolean {
    return !!(this.newMeeting.title && this.newMeeting.orgId && this.newMeeting.type && 
              this.newMeeting.date && this.newMeeting.time && this.newMeeting.host);
  }
}
