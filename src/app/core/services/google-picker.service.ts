import { Injectable, inject, NgZone } from '@angular/core';
import { Subject } from 'rxjs';

// Tipagem simplificada para gapi e google.picker
declare const gapi: any;
declare const google: any;

export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    url: string;
    oauthToken: string;
}

import { environment } from '../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class GooglePickerService {
    // @ts-ignore
    private clientId = environment['googleClientId'] || 'YOUR_CLIENT_ID_IF_NOT_IN_ENV';
    private apiKey = environment.firebaseConfig.apiKey;
    private appId = environment.firebaseConfig.messagingSenderId;


    private tokenClient: any;
    private gapiInited = false;
    private gisInited = false;

    private zone = inject(NgZone);

    private pickerSubject = new Subject<DriveFile>();

    constructor() {
        this.loadScripts();
    }

    private loadScripts() {
        // Load GAPI and GIS scripts dynamically
        const scriptGapi = document.createElement('script');
        scriptGapi.src = 'https://apis.google.com/js/api.js';
        scriptGapi.onload = () => this.gapiLoaded();
        document.body.appendChild(scriptGapi);

        const scriptGis = document.createElement('script');
        scriptGis.src = 'https://accounts.google.com/gsi/client';
        scriptGis.onload = () => this.gisLoaded();
        document.body.appendChild(scriptGis);
    }

    public openPicker(): Subject<DriveFile> {
        console.log('Open Picker requested. Status:', { gapi: this.gapiInited, gis: this.gisInited });

        if (!this.gapiInited || !this.gisInited) {
            console.warn('Scripts not loaded yet.');
            alert('Google API ainda carregando. Tente novamente em alguns segundos.');
            return this.pickerSubject;
        }

        // Reset previous callback to ensure clean state
        this.tokenClient.callback = async (resp: any) => {
            console.log('Token received', resp);
            if (resp.error !== undefined) {
                console.error('Token Error:', resp);
                throw (resp);
            }
            this.createPicker(resp.access_token);
        };

        // Always request access token to ensure we have a valid one for Picker
        console.log('Requesting access token...');
        this.tokenClient.requestAccessToken({ prompt: '' });

        return this.pickerSubject;
    }

    private createPicker(accessToken: string) {
        console.log('Creating Picker with token present');
        try {
            const view = new google.picker.View(google.picker.ViewId.DOCS);
            view.setMimeTypes('application/pdf');

            const picker = new google.picker.PickerBuilder()
                .enableFeature(google.picker.Feature.NAV_HIDDEN)
                .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
                .setAppId(this.appId)
                .setOAuthToken(accessToken)
                .addView(view)
                .setDeveloperKey(this.apiKey)
                .setCallback((data: any) => this.pickerCallback(data, accessToken))
                .build();

            picker.setVisible(true);
        } catch (e) {
            console.error('Error creating picker:', e);
            alert('Erro ao criar o Picker. Verifique o console.');
        }
    }

    private gapiLoaded() {
        console.log('GAPI Loaded');
        gapi.load('client:picker', () => {
            console.log('GAPI Client:Picker Loaded');
            this.gapiInited = true;
        });
    }

    private gisLoaded() {
        console.log('GIS Loaded');
        // @ts-ignore
        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: this.clientId,
            scope: 'https://www.googleapis.com/auth/drive.readonly',
            callback: '', // defined later
        });
        this.gisInited = true;
        console.log('Token Client initialized');
    }

    private pickerCallback(data: any, accessToken: string) {
        if (data.action === google.picker.Action.PICKED) {
            const doc = data.docs[0];
            const driveFile: DriveFile = {
                id: doc.id,
                name: doc.name,
                mimeType: doc.mimeType,
                url: doc.url,
                oauthToken: accessToken
            };
            this.zone.run(() => {
                this.pickerSubject.next(driveFile);
            });
        }
    }
}
