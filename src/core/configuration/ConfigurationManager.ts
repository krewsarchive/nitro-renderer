﻿import { NitroManager } from '../common/NitroManager';
import { ConfigurationEvent } from './ConfigurationEvent';
import { IConfigurationManager } from './IConfigurationManager';

export class ConfigurationManager extends NitroManager implements IConfigurationManager
{
    private _definitions: Map<string, unknown>;
    private _pendingUrls: string[];

    constructor()
    {
        super();

        this._definitions = new Map();
        this._pendingUrls = [];

        this.onConfigurationLoaded = this.onConfigurationLoaded.bind(this);
    }

    protected onInit(): void
    {
        //@ts-ignore
        const defaultConfig = this.getDefaultConfig();

        this._pendingUrls = defaultConfig['config.urls'] as string[];

        this.loadNextConfiguration();
    }

    private loadNextConfiguration(): void
    {
        if(!this._pendingUrls.length)
        {
            this.dispatchConfigurationEvent(ConfigurationEvent.LOADED);

            this.parseConfiguration(this.getDefaultConfig());

            return;
        }

        this.loadConfigurationFromUrl(this._pendingUrls[0]);
    }

    public loadConfigurationFromUrl(url: string): void
    {
        if(!url || (url === ''))
        {
            this.dispatchConfigurationEvent(ConfigurationEvent.FAILED);

            return;
        }

        fetch(url)
            .then(response => response.json())
            .then(data => this.onConfigurationLoaded(data, url))
            .catch(err => this.onConfigurationFailed(err));
    }

    private onConfigurationLoaded(data: { [index: string]: any }, url: string): void
    {
        if(!data) return;

        if(this.parseConfiguration(data))
        {
            const index = this._pendingUrls.indexOf(url);

            if(index >= 0) this._pendingUrls.splice(index, 1);

            this.loadNextConfiguration();

            return;
        }

        this.dispatchConfigurationEvent(ConfigurationEvent.FAILED);
    }

    private onConfigurationFailed(error: Error): void
    {
        this.dispatchConfigurationEvent(ConfigurationEvent.FAILED);
    }

    private dispatchConfigurationEvent(type: string): void
    {
        this.events && this.events.dispatchEvent(new ConfigurationEvent(type));
    }

    private parseConfiguration(data: { [index: string]: any }): boolean
    {
        if(!data) return false;

        try
        {
            const regex = new RegExp(/\${(.*?)}/g);

            for(const key in data)
            {
                let value = data[key];

                if(typeof value === 'string')
                {
                    value = this.interpolate((value as string), regex);
                }

                this._definitions.set(key, value);
            }

            return true;
        }

        catch (e)
        {
            this.logger.error(e.stack);

            return false;
        }
    }

    public interpolate(value: string, regex: RegExp = null): string
    {
        if(!regex) regex = new RegExp(/\${(.*?)}/g);

        const pieces = value.match(regex);

        if(pieces && pieces.length)
        {
            for(const piece of pieces)
            {
                const existing = (this._definitions.get(this.removeInterpolateKey(piece)) as string);

                if(existing) (value = value.replace(piece, existing));
            }
        }

        return value;
    }

    private removeInterpolateKey(value: string): string
    {
        return value.replace('${', '').replace('}', '');
    }

    public getValue<T>(key: string, value: T = null): T
    {
        let existing = this._definitions.get(key);

        if(existing === undefined)
        {
            this.logger.warn(`Missing configuration key: ${ key }`);

            existing = value;
        }

        return (existing as T);
    }

    public setValue(key: string, value: string): void
    {
        this._definitions.set(key, value);
    }

    public getDefaultConfig(): { [index: string]: any }
    {
        //@ts-ignore
        return NitroConfig as { [index: string]: any };
    }
}
