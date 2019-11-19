export interface IScriptFile {
  url: string;
  code: string;
}

export interface IContentScript {
  matches: string[];
  js: IScriptFile[];
  css: IScriptFile[];
  runAt: string;
}
