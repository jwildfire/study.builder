// study.viewer: look through any study's tables. It is a module of its own
// inside study.builder's repository: nothing here reads study.builder's
// builder, R or settings, so it can be lifted out as it is.
//
//   StudyViewer.mount(target, { study })       the viewer, on a page
//   StudyViewer.fromBuilt(study)               a study.builder study, as the viewer reads one
//   StudyViewer.viewerStudy / rowsOf / …       the same with no page

export { mountViewer as mount, VIEWS, PAGE } from './widget.js';
export {
  BARS,
  OPERATORS,
  PARTICIPANT_COLUMNS,
  PROFILE_ROWS,
  csvOf,
  filterRows,
  filterSaid,
  groupsOf,
  kindOf,
  participantColumnOf,
  participantOf,
  participantsOf,
  profileOf,
  rowsOf,
  sortRows,
  viewerStudy
} from './core.js';
export { fromBuilt } from './built.js';
export { VIEWER_STYLES, VIEWER_STYLE_ID } from './styles.js';
