export const requestUrl = jest.fn();

export const Platform = {
    isMobile:     false,
    isDesktop:    true,
    isDesktopApp: true,
    isMobileApp:  false,
};

export class Notice {
    constructor(public message: string) {}
}

export class Modal {
    app: unknown;
    contentEl = {
        empty: jest.fn(),
        createEl: jest.fn(() => ({ createEl: jest.fn() })),
        setText: jest.fn(),
    };
    constructor(app: unknown) { this.app = app; }
    open  = jest.fn();
    close = jest.fn();
}

export class Plugin {
    loadData  = jest.fn(async () => ({}));
    saveData  = jest.fn(async () => {});
    addCommand = jest.fn();
    addRibbonIcon = jest.fn();
    addSettingTab = jest.fn();
}

export class PluginSettingTab {
    app: unknown;
    containerEl = {
        empty: jest.fn(),
        createEl: jest.fn(() => ({ createEl: jest.fn() })),
    };
    constructor(app: unknown, _plugin: unknown) { this.app = app; }
}

export class Setting {
    constructor(_containerEl: unknown) {}
    setName    = () => this;
    setDesc    = () => this;
    addText    = (_cb: unknown) => this;
    addButton  = (_cb: unknown) => this;
    addDropdown = (_cb: unknown) => this;
    addTextArea = (_cb: unknown) => this;
}
