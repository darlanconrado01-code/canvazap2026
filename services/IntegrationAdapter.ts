
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, query, where, Timestamp, Firestore, DocumentData } from 'firebase/firestore';

export interface IntegrationConfig {
    id?: string;
    name: string;
    projectId: string;
    apiKey: string;
    authDomain: string;
    collectionPath: string;
    mapping: {
        nameField: string;
        descriptionField: string;
        dueDateField?: string;
    };
    active: boolean;
    companyId: string;
}

class IntegrationAdapter {
    private externalApps: Record<string, FirebaseApp> = {};
    private externalDbs: Record<string, Firestore> = {};

    private getExternalDb(config: IntegrationConfig): Firestore {
        const appName = `external_${config.id}`;

        if (!this.externalApps[appName]) {
            // Avoid duplicate initialization
            const existingApp = getApps().find(app => app.name === appName);
            if (existingApp) {
                this.externalApps[appName] = existingApp;
            } else {
                this.externalApps[appName] = initializeApp({
                    apiKey: config.apiKey,
                    authDomain: config.authDomain,
                    projectId: config.projectId
                }, appName);
            }
        }

        if (!this.externalDbs[appName]) {
            this.externalDbs[appName] = getFirestore(this.externalApps[appName]);
        }

        return this.externalDbs[appName];
    }

    public subscribeToExternal(config: IntegrationConfig, onNewDoc: (taskData: any) => void) {
        try {
            const db = this.getExternalDb(config);
            const q = query(collection(db, config.collectionPath));

            return onSnapshot(q, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added") {
                        const data = change.doc.data();

                        // Map external data to our Task format
                        const mappedTask = {
                            name: data[config.mapping.nameField] || 'Tarefa Integrada',
                            description: data[config.mapping.descriptionField] || '',
                            externalId: change.doc.id,
                            externalProjectId: config.projectId,
                            source: 'INTEGRATION',
                            integratedAt: Timestamp.now()
                        };

                        onNewDoc(mappedTask);
                    }
                });
            });
        } catch (error) {
            console.error("Error in IntegrationAdapter:", error);
            return () => { };
        }
    }
}

export const integrationAdapter = new IntegrationAdapter();
