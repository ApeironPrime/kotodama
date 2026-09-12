/**
 * Runtime schema validators for Canonical Vocabulary Curriculum contracts.
 * Independent of DB, ORM, or external libraries.
 */

export const VALID_LEVELS = new Set(['A1', 'A2', 'N5', 'N4', 'N3', 'N2', 'N1', 'SE'])
export const VALID_RIGHTS = new Set(['unknown', 'verified', 'public_domain', 'licensed'])
export const VALID_VISIBILITY = new Set(['public', 'unlisted', 'private', 'internal'])

/**
 * Validates a Canonical Course
 * @param {any} course
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCourse(course) {
  const errors = []
  if (!course || typeof course !== 'object') return { valid: false, errors: ['Course must be an object'] }
  if (typeof course.course_code !== 'string' || !course.course_code.trim()) errors.push('course_code must be a non-empty string')
  if (typeof course.title !== 'string' || !course.title.trim()) errors.push('title must be a non-empty string')
  if (!VALID_LEVELS.has(course.level)) errors.push(`level '${course.level}' is invalid; must be one of ${Array.from(VALID_LEVELS).join(', ')}`)
  if (typeof course.provider_source !== 'string') errors.push('provider_source must be a string')
  if (!VALID_VISIBILITY.has(course.visibility)) errors.push(`visibility '${course.visibility}' is invalid`)
  if (!VALID_RIGHTS.has(course.rights_status)) errors.push(`rights_status '${course.rights_status}' is invalid`)

  return { valid: errors.length === 0, errors }
}

/**
 * Validates a Canonical Unit
 * @param {any} unit
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateUnit(unit) {
  const errors = []
  if (!unit || typeof unit !== 'object') return { valid: false, errors: ['Unit must be an object'] }
  if (typeof unit.unit_id !== 'string' || !unit.unit_id.trim()) errors.push('unit_id must be a non-empty string')
  if (typeof unit.course_code !== 'string' || !unit.course_code.trim()) errors.push('course_code must be a non-empty string')
  if (typeof unit.unit_key !== 'string' || !unit.unit_key.trim()) errors.push('unit_key must be a non-empty string')
  if (typeof unit.ordinal !== 'number' || isNaN(unit.ordinal)) errors.push('ordinal must be a number')
  if (typeof unit.title !== 'string' || !unit.title.trim()) errors.push('title must be a non-empty string')

  return { valid: errors.length === 0, errors }
}

/**
 * Validates a Canonical Term
 * @param {any} term
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateTerm(term) {
  const errors = []
  if (!term || typeof term !== 'object') return { valid: false, errors: ['Term must be an object'] }
  if (typeof term.term_id !== 'string' || !term.term_id.trim()) errors.push('term_id must be a non-empty string')
  if (typeof term.normalized_key !== 'string' || !term.normalized_key.trim()) errors.push('normalized_key must be a non-empty string')
  if (typeof term.display_word !== 'string') errors.push('display_word must be a string')
  if (typeof term.display_reading !== 'string') errors.push('display_reading must be a string')
  if (!Array.isArray(term.meanings) || term.meanings.length === 0) {
    errors.push('meanings must be a non-empty array of strings')
  } else {
    for (let i = 0; i < term.meanings.length; i++) {
      if (typeof term.meanings[i] !== 'string' || !term.meanings[i].trim()) {
        errors.push(`meanings[${i}] must be a non-empty string`)
      }
    }
  }
  if (term.han_viet !== null && typeof term.han_viet !== 'string') errors.push('han_viet must be string or null')
  if (!Array.isArray(term.examples)) {
    errors.push('examples must be an array')
  } else {
    for (let i = 0; i < term.examples.length; i++) {
      const ex = term.examples[i]
      if (!ex || typeof ex !== 'object') {
        errors.push(`examples[${i}] must be an object`)
      } else {
        if (typeof ex.ja !== 'string' || !ex.ja.trim()) errors.push(`examples[${i}].ja must be a non-empty string`)
        if (typeof ex.vi !== 'string') errors.push(`examples[${i}].vi must be a string`)
      }
    }
  }
  if (term.display_reading && /\p{Script=Latin}/u.test(term.display_reading)) {
    errors.push(`term '${term.normalized_key}' has invalid display_reading containing Latin/Vietnamese: '${term.display_reading}'`)
  }
  if (!Array.isArray(term.raw_source_references)) {
    errors.push('raw_source_references must be an array')
  } else {
    for (let i = 0; i < term.raw_source_references.length; i++) {
      const ref = term.raw_source_references[i]
      if (!ref || typeof ref !== 'object') {
        errors.push(`raw_source_references[${i}] must be an object`)
      } else {
        if (typeof ref.source !== 'string' || !ref.source.trim()) {
          errors.push(`raw_source_references[${i}].source must be a non-empty string`)
        }
        if (typeof ref.raw_record_id !== 'string' && (typeof ref.raw_record_id !== 'number' || isNaN(ref.raw_record_id))) {
          errors.push(`raw_source_references[${i}].raw_record_id must be a string or number`)
        }
        if (typeof ref.lesson !== 'string') errors.push(`raw_source_references[${i}].lesson must be a string`)
        if (typeof ref.level !== 'string') errors.push(`raw_source_references[${i}].level must be a string`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validates a Canonical ImportRun metadata object
 * @param {any} import_run
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateImportRun(import_run) {
  const errors = []
  if (!import_run || typeof import_run !== 'object') return { valid: false, errors: ['import_run must be an object'] }
  if (typeof import_run.source_manifest_hash !== 'string' || !import_run.source_manifest_hash.trim()) {
    errors.push('import_run.source_manifest_hash must be a non-empty string')
  }
  if (typeof import_run.importer_version !== 'string' || !import_run.importer_version.trim()) {
    errors.push('import_run.importer_version must be a non-empty string')
  }
  if (typeof import_run.total_input_records !== 'number' || isNaN(import_run.total_input_records)) errors.push('import_run.total_input_records must be a number')
  if (typeof import_run.total_canonical_terms !== 'number' || isNaN(import_run.total_canonical_terms)) errors.push('import_run.total_canonical_terms must be a number')
  if (typeof import_run.total_course_terms !== 'number' || isNaN(import_run.total_course_terms)) errors.push('import_run.total_course_terms must be a number')
  if (typeof import_run.total_courses !== 'number' || isNaN(import_run.total_courses)) errors.push('import_run.total_courses must be a number')
  if (typeof import_run.total_units !== 'number' || isNaN(import_run.total_units)) errors.push('import_run.total_units must be a number')
  if (typeof import_run.warning_count !== 'number' || isNaN(import_run.warning_count)) errors.push('import_run.warning_count must be a number')
  if (typeof import_run.error_count !== 'number' || isNaN(import_run.error_count)) errors.push('import_run.error_count must be a number')
  if (!Array.isArray(import_run.reject_list)) {
    errors.push('import_run.reject_list must be an array')
  } else {
    for (let i = 0; i < import_run.reject_list.length; i++) {
      const r = import_run.reject_list[i]
      if (!r || typeof r !== 'object') {
        errors.push(`import_run.reject_list[${i}] must be an object`)
      } else {
        if (typeof r.index !== 'number' || isNaN(r.index)) errors.push(`import_run.reject_list[${i}].index must be a number`)
        if (typeof r.word !== 'string') errors.push(`import_run.reject_list[${i}].word must be a string`)
        if (typeof r.reason !== 'string' || !r.reason.trim()) errors.push(`import_run.reject_list[${i}].reason must be a non-empty string`)
      }
    }
  }
  if (!Array.isArray(import_run.warnings)) {
    errors.push('import_run.warnings must be an array')
  } else {
    for (let i = 0; i < import_run.warnings.length; i++) {
      const w = import_run.warnings[i]
      if (!w || typeof w !== 'object') {
        errors.push(`import_run.warnings[${i}] must be an object`)
      } else {
        if (typeof w.index !== 'number' || isNaN(w.index)) errors.push(`import_run.warnings[${i}].index must be a number`)
        if (typeof w.code !== 'string' || !w.code.trim()) errors.push(`import_run.warnings[${i}].code must be a non-empty string`)
        if (typeof w.message !== 'string' || !w.message.trim()) errors.push(`import_run.warnings[${i}].message must be a non-empty string`)
      }
    }
  }
  if (import_run.imported_at !== undefined) {
    errors.push('import_run.imported_at must not be present in canonical dataset (timestamps belong in validation-report.md)')
  }
  return { valid: errors.length === 0, errors }
}

/**
 * Validates a Canonical CourseTerm
 * @param {any} ct
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCourseTerm(ct) {
  const errors = []
  if (!ct || typeof ct !== 'object') return { valid: false, errors: ['CourseTerm must be an object'] }
  if (typeof ct.course_code !== 'string' || !ct.course_code.trim()) errors.push('course_code must be a non-empty string')
  if (typeof ct.unit_id !== 'string' || !ct.unit_id.trim()) errors.push('unit_id must be a non-empty string')
  if (typeof ct.term_id !== 'string' || !ct.term_id.trim()) errors.push('term_id must be a non-empty string')
  if (typeof ct.ordinal !== 'number' || isNaN(ct.ordinal) || ct.ordinal < 1) errors.push('ordinal must be a positive number')
  if (typeof ct.source_record_id !== 'string' && (typeof ct.source_record_id !== 'number' || isNaN(ct.source_record_id))) {
    errors.push('source_record_id must be a string or number')
  }
  if (!ct.provenance || typeof ct.provenance !== 'object') {
    errors.push('provenance must be an object')
  } else {
    if (typeof ct.provenance.source !== 'string' || !ct.provenance.source.trim()) errors.push('provenance.source must be a non-empty string')
    if (!VALID_RIGHTS.has(ct.provenance.rights_status)) errors.push(`provenance.rights_status '${ct.provenance.rights_status}' is invalid`)
    if (typeof ct.provenance.raw_level !== 'string') errors.push('provenance.raw_level must be a string')
    if (typeof ct.provenance.raw_lesson !== 'string') errors.push('provenance.raw_lesson must be a string')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validates a Canonical Dataset (100% exhaustive check with referential integrity, uniqueness, and count reconciliation)
 * @param {any} dataset
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateDataset(dataset) {
  const errors = []
  if (!dataset || typeof dataset !== 'object') return { valid: false, errors: ['Dataset must be an object'] }
  const runValidation = validateImportRun(dataset.import_run)
  if (!runValidation.valid) errors.push(...runValidation.errors)
  if (!Array.isArray(dataset.courses)) errors.push('dataset.courses must be an array')
  if (!Array.isArray(dataset.units)) errors.push('dataset.units must be an array')
  if (!Array.isArray(dataset.terms)) errors.push('dataset.terms must be an array')
  if (!Array.isArray(dataset.course_terms)) errors.push('dataset.course_terms must be an array')

  if (errors.length > 0) return { valid: false, errors }

  // 1. Reconciliation of import_run counts with actual array lengths
  if (dataset.import_run) {
    if (dataset.import_run.total_courses !== dataset.courses.length) {
      errors.push(`import_run.total_courses (${dataset.import_run.total_courses}) does not match courses.length (${dataset.courses.length})`)
    }
    if (dataset.import_run.total_units !== dataset.units.length) {
      errors.push(`import_run.total_units (${dataset.import_run.total_units}) does not match units.length (${dataset.units.length})`)
    }
    if (dataset.import_run.total_canonical_terms !== dataset.terms.length) {
      errors.push(`import_run.total_canonical_terms (${dataset.import_run.total_canonical_terms}) does not match terms.length (${dataset.terms.length})`)
    }
    if (dataset.import_run.total_course_terms !== dataset.course_terms.length) {
      errors.push(`import_run.total_course_terms (${dataset.import_run.total_course_terms}) does not match course_terms.length (${dataset.course_terms.length})`)
    }
    if (Array.isArray(dataset.import_run.warnings) && dataset.import_run.warning_count !== dataset.import_run.warnings.length) {
      errors.push(`import_run.warning_count (${dataset.import_run.warning_count}) does not match warnings.length (${dataset.import_run.warnings.length})`)
    }
    if (Array.isArray(dataset.import_run.reject_list) && dataset.import_run.error_count !== dataset.import_run.reject_list.length) {
      errors.push(`import_run.error_count (${dataset.import_run.error_count}) does not match reject_list.length (${dataset.import_run.reject_list.length})`)
    }
  }

  // 2. Validate courses & enforce uniqueness of course_code
  const courseCodeSet = new Set()
  for (let i = 0; i < dataset.courses.length; i++) {
    const c = dataset.courses[i]
    const v = validateCourse(c)
    if (!v.valid) errors.push(`courses[${i}]: ${v.errors.join('; ')}`)
    if (c && typeof c.course_code === 'string') {
      if (courseCodeSet.has(c.course_code)) {
        errors.push(`duplicate course_code '${c.course_code}' at courses[${i}]`)
      }
      courseCodeSet.add(c.course_code)
    }
  }

  // 3. Validate units & enforce uniqueness of unit_id & referential integrity to course_code
  const unitMap = new Map() // unit_id -> course_code
  for (let i = 0; i < dataset.units.length; i++) {
    const u = dataset.units[i]
    const v = validateUnit(u)
    if (!v.valid) {
      errors.push(`units[${i}]: ${v.errors.join('; ')}`)
    } else {
      if (unitMap.has(u.unit_id)) {
        errors.push(`duplicate unit_id '${u.unit_id}' at units[${i}]`)
      }
      if (!courseCodeSet.has(u.course_code)) {
        errors.push(`units[${i}] '${u.unit_id}' references non-existent course_code '${u.course_code}'`)
      }
      unitMap.set(u.unit_id, u.course_code)
    }
  }

  // 4. Validate terms & enforce uniqueness of term_id
  const termIdSet = new Set()
  for (let i = 0; i < dataset.terms.length; i++) {
    const t = dataset.terms[i]
    const v = validateTerm(t)
    if (!v.valid) errors.push(`terms[${i}]: ${v.errors.join('; ')}`)
    if (t && typeof t.term_id === 'string') {
      if (termIdSet.has(t.term_id)) {
        errors.push(`duplicate term_id '${t.term_id}' at terms[${i}]`)
      }
      termIdSet.add(t.term_id)
    }
  }

  // 5. Validate course_terms & enforce uniqueness of course_code + unit_id + ordinal & referential integrity
  const courseUnitOrdinalSet = new Set()
  for (let i = 0; i < dataset.course_terms.length; i++) {
    const ct = dataset.course_terms[i]
    const v = validateCourseTerm(ct)
    if (!v.valid) {
      errors.push(`course_terms[${i}]: ${v.errors.join('; ')}`)
    } else {
      const positionKey = `${ct.course_code}::${ct.unit_id}::${ct.ordinal}`
      if (courseUnitOrdinalSet.has(positionKey)) {
        errors.push(`duplicate position (${positionKey}) at course_terms[${i}]`)
      }
      courseUnitOrdinalSet.add(positionKey)

      if (!courseCodeSet.has(ct.course_code)) {
        errors.push(`course_terms[${i}] references non-existent course_code '${ct.course_code}'`)
      }
      if (!unitMap.has(ct.unit_id)) {
        errors.push(`course_terms[${i}] references non-existent unit_id '${ct.unit_id}'`)
      } else {
        const expectedCourse = unitMap.get(ct.unit_id)
        if (expectedCourse !== ct.course_code) {
          errors.push(`course_terms[${i}] unit '${ct.unit_id}' belongs to course '${expectedCourse}', but course_term specifies course_code '${ct.course_code}'`)
        }
      }
      if (!termIdSet.has(ct.term_id)) {
        errors.push(`course_terms[${i}] references non-existent term_id '${ct.term_id}'`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}
