import { Injectable } from '@angular/core';
import { DatePipe } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class DatePicker {
    constructor(private datePipe: DatePipe) { }

     static reverseFormatDate = (formattedDate: string): string => {
    if (formattedDate === '' || formattedDate == null) {
      return '';
    }

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const regex = /^(\d{2}) (\w+), (\d{4})$/;
    const match = formattedDate.match(regex);

    if (!match) {
      return '';
    }

    const [, day, monthName, year] = match;
    const monthIndex = monthNames.indexOf(monthName);

    if (monthIndex === -1) {
      return '';
    }

    const formattedMonth = String(monthIndex + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');

    return `${year}-${formattedMonth}-${formattedDay}`;
  };

  static formatDate = (inputDate: string | Date): string => {
    if (inputDate == '' || inputDate == null || inputDate == '0000-00-00' || inputDate == undefined) {
      return '';
    }

    let date: Date;
    if (typeof inputDate === 'string') {
      // Parse string date as local date to avoid timezone shifts
      const parts = inputDate.split('-');
      if (parts.length === 3) {
        date = new Date(
          parseInt(parts[0]),
          parseInt(parts[1]) - 1,
          parseInt(parts[2])
        );
      } else {
        date = new Date(inputDate);
      }
    } else {
      date = inputDate;
    }

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const day = date.getDate();
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();

    return `${String(day).padStart(2, '0')} ${month}, ${year}`;
  };

  static format = (date: Date | string): string => {
    // Handle string input
    if (typeof date === 'string') {
      const parts = date.split('-');
      if (parts.length === 3) {
        // Already in YYYY-MM-DD format
        return date;
      }
    }

    // Handle Date object - use getters to avoid timezone issues
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  };

  static getMonthFromDate = (dateString: string): string => {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const month = parseInt(parts[1]);
      return String(month).padStart(2, '0');
    }

    // Fallback
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    return month < 10 ? `0${month}` : `${month}`;
  };

  static formatDateToLongForm(input: string): string {
    try {
      let day: number, month: number, year: number;

      if (/^\d{2}-\d{2}-\d{4}$/.test(input)) {
        const [d, m, y] = input.split('-');
        day = parseInt(d, 10);
        month = parseInt(m, 10) - 1;
        year = parseInt(y, 10);
      }
      else if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
        const [y, m, d] = input.split('-');
        day = parseInt(d, 10);
        month = parseInt(m, 10) - 1;
        year = parseInt(y, 10);
      } else {
        throw new Error('Invalid format');
      }

      // Use local date constructor to avoid timezone issues
      const date = new Date(year, month, day);
      if (isNaN(date.getTime())) throw new Error('Invalid date');

      const dayStr = date.getDate().toString().padStart(2, '0');
      const monthStr = date.toLocaleString('en-GB', { month: 'long' });
      const yearStr = date.getFullYear();

      return `${dayStr} ${monthStr}, ${yearStr}`;
    } catch (error) {
      return input;
    }
  }

  static getAttachments(input: string | string[]): string[] {
    const attachmentExtensions = [
      '.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx',
      '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv',
      '.zip', '.rar'
    ];

    const hasAttachmentExtension = (str: string): boolean =>
      attachmentExtensions.some(ext => str.trim().toLowerCase().endsWith(ext));

    try {
      if (!input || (Array.isArray(input) && input.length === 0)) {
        return [];
      }

      let inputs: string[];

      if (Array.isArray(input)) {
        inputs = input;
      } else if (typeof input === 'string' && input.includes(',')) {
        inputs = input.split(',').map(str => str.trim());
      } else {
        inputs = [input.trim()];
      }

      const filtered = inputs.filter(item => hasAttachmentExtension(item));
      return filtered.length > 0 ? filtered : [];

    } catch (error) {
      console.error('Error in getAttachments:', error);
      return [];
    }
  }
  static explicitFormatDate = (inputDate: string | Date | null | undefined): string => {
    if (!inputDate || inputDate === '0000-00-00') return '';

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Helper to format parts
    const formatParts = (day: number, monthIndex: number, year: number) =>
      `${String(day).padStart(2, '0')} ${monthNames[monthIndex]}, ${year}`;

    if (typeof inputDate === 'string') {
      // ✅ Manual parse — avoids timezone shift
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(inputDate);
      if (match) {
        const [_, y, m, d] = match;
        const year = Number(y);
        const month = Number(m) - 1;
        const day = Number(d);
        // Don’t call new Date() — just format directly
        return formatParts(day, month, year);
      }

      // For datetime strings, fall back to UTC-safe parsing
      const date = new Date(inputDate);
      if (isNaN(date.getTime())) return '';
      return formatParts(date.getUTCDate(), date.getUTCMonth(), date.getUTCFullYear());
    }

    // If already a Date object, assume you *want* local interpretation
    const date = inputDate as Date;
    if (isNaN(date.getTime())) return '';
    return formatParts(date.getDate(), date.getMonth(), date.getFullYear());
  };
}
