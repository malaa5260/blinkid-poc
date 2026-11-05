import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type {
  BlinkIdComponent,
  BlinkIdScanningResult,
  StringResult,
} from '@microblink/blinkid';
import { BLINKID_LICENSE_KEY } from '../blinkid.config';

/** The fields we care about, flattened into plain strings for the form. */
export interface ScannedId {
  fullName: string;
  firstName: string;
  lastName: string;
  documentNumber: string;
  dateOfBirth: string;
  dateOfExpiry: string;
  address: string;
  nationality: string;
  sex: string;
  country: string;
}

type Status = 'idle' | 'loading' | 'scanning' | 'done' | 'error';

@Component({
  selector: 'app-id-scanner',
  templateUrl: './id-scanner.html',
  styleUrl: './id-scanner.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdScanner implements OnDestroy {
  /** Emits once the user has finished scanning a document. */
  readonly scanned = output<ScannedId>();

  protected readonly status = signal<Status>('idle');
  protected readonly errorMessage = signal('');

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('scannerHost');
  private blinkId?: BlinkIdComponent;

  async start(): Promise<void> {
    if (this.status() === 'loading' || this.status() === 'scanning') return;

    if (!BLINKID_LICENSE_KEY || BLINKID_LICENSE_KEY.startsWith('PASTE-')) {
      this.fail('Add your BlinkID license key in src/app/blinkid.config.ts first.');
      return;
    }

    this.status.set('loading');
    this.errorMessage.set('');

    try {
      // Lazy-load the SDK so its ~700 kB JS (plus Wasm) is only downloaded
      // when the user actually opens the scanner, not on app start.
      const { createBlinkId } = await import('@microblink/blinkid');

      this.blinkId = await createBlinkId({
        licenseKey: BLINKID_LICENSE_KEY,
        targetNode: this.host().nativeElement,
        // Wasm + worker files are copied to /resources by angular.json.
        // Set this explicitly: the default is the current page URL,
        // which breaks as soon as you are on a nested route.
        resourcesLocation: new URL('.', document.baseURI).href,
        cameraManagerUiOptions: { showCloseButton: true },
      });

      this.status.set('scanning');

      this.blinkId.addOnResultCallback((result) => {
        this.scanned.emit(toScannedId(result));
        this.status.set('done');
        void this.stop();
      });

      this.blinkId.addOnErrorCallback((error) => {
        console.error('BlinkID error', error);
        this.fail('The scan could not be completed. Please try again.');
      });
    } catch (error) {
      console.error('BlinkID failed to start', error);
      this.fail(describeStartError(error));
    }
  }

  async stop(): Promise<void> {
    const instance = this.blinkId;
    this.blinkId = undefined;
    // Releases the camera, the worker and the Wasm memory.
    await instance?.destroy();
    if (this.status() === 'scanning' || this.status() === 'loading') {
      this.status.set('idle');
    }
  }

  ngOnDestroy(): void {
    void this.stop();
  }

  private fail(message: string): void {
    this.errorMessage.set(message);
    this.status.set('error');
    void this.stop();
  }
}

/** BlinkID returns every text field per alphabet; prefer Latin, then Arabic. */
function text(field: StringResult | undefined): string {
  if (!field) return '';
  return (
    field.latin?.value ||
    field.arabic?.value ||
    field.cyrillic?.value ||
    field.greek?.value ||
    ''
  );
}

function date(field: BlinkIdScanningResult['dateOfBirth']): string {
  if (!field?.year || !field.month || !field.day) return text(field?.originalString);
  const mm = String(field.month).padStart(2, '0');
  const dd = String(field.day).padStart(2, '0');
  return `${field.year}-${mm}-${dd}`;
}

function toScannedId(r: BlinkIdScanningResult): ScannedId {
  return {
    fullName: text(r.fullName),
    firstName: text(r.firstName),
    lastName: text(r.lastName),
    documentNumber: text(r.documentNumber),
    dateOfBirth: date(r.dateOfBirth),
    dateOfExpiry: date(r.dateOfExpiry),
    address: text(r.address),
    nationality: text(r.nationality),
    sex: text(r.sex),
    country: r.documentClassInfo?.countryName ?? '',
  };
}

function describeStartError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (/licen[cs]e|initialize/i.test(msg)) {
    return 'BlinkID could not initialize. Check that the license key is valid for this domain.';
  }
  if (/permission|NotAllowed/i.test(msg)) {
    return 'Camera permission was denied.';
  }
  if (!window.isSecureContext) {
    return 'The camera only works on HTTPS or localhost.';
  }
  return 'The scanner could not start. Check the browser console for details.';
}
