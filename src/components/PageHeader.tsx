import { Settings2, type LucideIcon } from 'lucide-react'

export default function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon = Settings2,
  hanko,
  jpVertical,
}: {
  eyebrow: string
  title: string
  description: string
  icon?: LucideIcon
  hanko?: string
  jpVertical?: string
}) {
  if (hanko || jpVertical) {
    return (
      <header className="page-header washi-masthead">
        <div className="washi-masthead__lead">
          {hanko && (
            <span className="washi-hanko" aria-hidden="true">
              {hanko}
            </span>
          )}
          <div>
            <div className="washi-masthead__eyebrow">
              <Icon aria-hidden="true" size={14} strokeWidth={2.2} />
              {eyebrow}
            </div>
            <h1 className="washi-masthead__title">{title}</h1>
            <p className="washi-masthead__desc">{description}</p>
          </div>
        </div>
        {jpVertical && (
          <span className="washi-vertical-tag" aria-hidden="true">
            {jpVertical}
          </span>
        )}
      </header>
    )
  }

  return (
    <header className="page-header">
      <div className="page-header__eyebrow">
        <Icon aria-hidden="true" size={15} strokeWidth={2.25} />
        {eyebrow}
      </div>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  )
}
