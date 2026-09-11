import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-client-dashboard',
  imports: [CommonModule],
  templateUrl: './client-dashboard.html',
  styleUrl: './client-dashboard.css',
})
export class ClientDashboard {
  orgName = '';
  orgId: string | null = null;

  constructor(

    private location: Location,
    private route: ActivatedRoute

  ) {}

    ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.orgName = params.get('orgName') ?? '';
      this.orgId = params.get('orgId');
    });
  }

 goBack(): void {
    this.location.back();
  }

}
