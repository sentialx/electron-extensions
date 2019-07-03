import { IpcEvent } from './events/ipc-event';

export const getWebNavigation = () => ({
  onBeforeNavigate: new IpcEvent('webNavigation', 'onBeforeNavigate'),
  onCommitted: new IpcEvent('webNavigation', 'onCommitted'),
  onDOMContentLoaded: new IpcEvent('webNavigation', 'onDOMContentLoaded'),
  onCompleted: new IpcEvent('webNavigation', 'onCompleted'),
  onCreatedNavigationTarget: new IpcEvent(
    'webNavigation',
    'onCreatedNavigationTarget',
  ),
  onReferenceFragmentUpdated: new IpcEvent(
    'webNavigation',
    'onReferenceFragmentUpdated',
  ), // TODO
  onTabReplaced: new IpcEvent('webNavigation', 'onTabReplaced'), // TODO
  onHistoryStateUpdated: new IpcEvent('webNavigation', 'onHistoryStateUpdated'), // TODO
});
