import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { IdScanner, ScannedId } from './id-scanner/id-scanner';

const EMPTY: ScannedId = {
  fullName: '',
  firstName: '',
  lastName: '',
  documentNumber: '',
  dateOfBirth: '',
  dateOfExpiry: '',
  address: '',
  nationality: '',
  sex: '',
  country: '',
};

@Component({
  selector: 'app-root',
  imports: [IdScanner],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  /** Form model: filled automatically by the scanner, still editable by the user. */
  protected readonly form = signal<ScannedId>(EMPTY);

  protected readonly fields: { key: keyof ScannedId; label: string; type?: string }[] = [
    { key: 'fullName', label: 'Full name' },
    { key: 'documentNumber', label: 'Document number' },
    { key: 'dateOfBirth', label: 'Date of birth', type: 'date' },
    { key: 'dateOfExpiry', label: 'Expiry date', type: 'date' },
    { key: 'sex', label: 'Sex' },
    { key: 'nationality', label: 'Nationality' },
    { key: 'country', label: 'Issuing country' },
    { key: 'address', label: 'Address' },
  ];

  protected onScanned(id: ScannedId): void {
    // Some documents only have first/last name, not a full name.
    const fullName = id.fullName || [id.firstName, id.lastName].filter(Boolean).join(' ');
    this.form.set({ ...id, fullName });
  }

  protected update(key: keyof ScannedId, value: string): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }
}
