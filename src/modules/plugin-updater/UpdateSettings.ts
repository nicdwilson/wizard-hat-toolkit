import * as LocalMain from '@getflywheel/local/main';

export class UpdateSettingsManager {
    static setLastUpdateCheck(date: Date): void {
        LocalMain.UserData.set('lastUpdateCheck', date.toISOString());
    }

    static getLastUpdateCheck(): Date | null {
        const lastCheck = LocalMain.UserData.get('lastUpdateCheck');
        return lastCheck ? new Date(lastCheck) : null;
    }
}
