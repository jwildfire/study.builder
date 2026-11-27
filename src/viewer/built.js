// A study study.builder built, as the viewer reads one. This is the only file
// of the viewer that knows a built study's shape, and it reads nothing but the
// study it is handed: its layers, its tables and its metadata.

/**
 * A built study for the viewer: its tables listed by layer, each column with
 * its label, type, key and joins from the study's metadata, and what made it.
 * @param {Object} study What `StudyBuilder.buildStudy` or `openStudy` resolved to.
 * @param {{layers?: string[]}} [options] The layers to show; all of them unless told.
 * @returns {Object} What `viewerStudy` takes.
 */
export function fromBuilt(study, { layers = null } = {}) {
  const shown = study.layers.filter((layer) => !layers || layers.includes(layer.id));
  const args = study.args || {};
  return {
    name: study.id,
    kind: 'Simulated',
    about: study.said || '',
    facts: [
      { label: 'Phase', value: args.phase },
      { label: 'Therapeutic area', value: args.therapeutic_area },
      { label: 'Participants', value: args.participants },
      { label: 'Sites', value: args.sites },
      { label: 'Months', value: args.months },
      { label: 'Snapshot', value: study.snapshotDate }
    ],
    tables: shown.flatMap((layer) =>
      layer.tables.map((table) => {
        const spec = typeof study.spec === 'function' ? study.spec(layer.id, table.id) : null;
        const about = new Map((spec ? spec.columns : []).map((column) => [column.name, column]));
        return {
          id: `${layer.id}:${table.id}`,
          label: table.label,
          group: layer.label,
          file: table.name,
          text: table.text,
          rows: table.rows,
          about: table.about || table.grain || table.description || '',
          made:
            layer.id === 'raw'
              ? 'simulated by a modified copy of gsm.datasim'
              : table.made.from.length
                ? `built from ${table.made.from.join(' and ')} by the ${table.made.workflow} workflow`
                : `built by the ${table.made.workflow} workflow`,
          columns: table.columns.map((column) => {
            const said = about.get(column.name) || {};
            return {
              name: column.name,
              type: column.type,
              label: said.label || '',
              key: Boolean(said.key),
              ...(said.joins ? { joins: said.joins } : {})
            };
          })
        };
      })
    )
  };
}
