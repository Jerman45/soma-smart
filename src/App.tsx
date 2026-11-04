import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  BookText,
  Check,
  ChevronDown,
  CircleHelp,
  FileText,
  Flag,
  Filter,
  GraduationCap,
  Layers3,
  LibraryBig,
  LoaderCircle,
  LockKeyhole,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import {
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useSearchParams,
  useParams,
  useLocation,
} from 'react-router-dom'
import {
  addResource,
  createCategory,
  createSubject,
  createReport,
  downloadResourceFile,
  getContactMessages,
  deleteResource,
  getCategories,
  getAdminDashboardStats,
  getAdminProfiles,
  getResource,
  getResources,
  getReports,
  getSignedCoverUrl,
  getSubjects,
  getSignedFileUrl,
  removeCategory,
  setSubjectActive,
  setReportStatus,
  setCategoryActive,
  setContactMessageStatus,
  setAdminProfileName,
  setProfileRole,
  submitContactMessage,
  setResourcePublished,
  updateResource,
  type Category,
  type Resource,
  type ResourceReport,
  type ContactMessage,
  type AdminProfile,
  type Subject,
} from './lib/library'
import { supabase, supabaseConfigured } from './lib/supabase'
import './App.css'

const currentYear = new Date().getFullYear()
const contactEmail = import.meta.env.VITE_CONTACT_EMAIL?.trim()
const PdfPreview = lazy(() => import('./components/PdfPreview'))

const resourceTypes = [
  { title: 'Textbooks', description: 'Core books for every subject and class.', icon: BookOpen, category: 'Textbooks' },
  { title: 'Past papers', description: 'Prepare with previous examination papers.', icon: FileText, category: 'Past Examination Papers' },
  { title: 'Study notes', description: 'Clear notes to make complex topics simpler.', icon: BookText, category: 'Study Notes' },
  { title: 'Mock exams', description: 'Practice under exam-style conditions.', icon: Layers3, category: 'Mock Examinations' },
]

const classLevels = ['Form I', 'Form II', 'Form III', 'Form IV', 'Form V', 'Form VI']
const academicLevels = ['Ordinary Level (O-Level)', 'Advanced Level (A-Level)']
const maxUploadBytes = 50 * 1024 * 1024

function readableError(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const navigate = useNavigate()

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    navigate(`/library${searchText.trim() ? `?q=${encodeURIComponent(searchText.trim())}` : ''}`)
    setMenuOpen(false)
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" to="/" aria-label="Soma Smart home">
          <span className="brand-mark"><BookOpenCheck size={23} strokeWidth={2.2} /></span>
          <span className="brand-copy"><strong>SOMA<span>SMART</span></strong><small>LEARN MORE. ACHIEVE MORE.</small></span>
        </Link>
        <button className="mobile-menu-button" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <nav className={`main-nav${menuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
          <Link to="/" onClick={() => setMenuOpen(false)}>Home</Link>
          <Link to="/library" onClick={() => setMenuOpen(false)}>Library</Link>
          <Link to="/library?category=Textbooks" onClick={() => setMenuOpen(false)}>Textbooks</Link>
          <Link to="/library?category=Past%20Examination%20Papers" onClick={() => setMenuOpen(false)}>Past papers</Link>
          <Link to="/about" onClick={() => setMenuOpen(false)}>About</Link>
          <Link to="/contact" onClick={() => setMenuOpen(false)}>Contact</Link>
          <form className="nav-search" onSubmit={submitSearch} role="search">
            <Search size={17} aria-hidden="true" />
            <input aria-label="Search learning materials" placeholder="Search resources" value={searchText} onChange={(event) => setSearchText(event.target.value)} />
            <button type="submit" aria-label="Submit search"><ArrowRight size={16} /></button>
          </form>
        </nav>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link className="brand brand-light" to="/">
            <span className="brand-mark"><BookOpenCheck size={22} /></span>
            <span className="brand-copy"><strong>SOMA<span>SMART</span></strong><small>LEARN MORE. ACHIEVE MORE.</small></span>
          </Link>
          <p>Free learning resources to help every Tanzanian student move forward with confidence.</p>
        </div>
        <div><h3>Explore</h3><Link to="/library">Library</Link><Link to="/library?category=Textbooks">Textbooks</Link><Link to="/library?category=Past%20Examination%20Papers">Past papers</Link></div>
        <div><h3>About Soma Smart</h3><Link to="/about">Our mission</Link><Link to="/contact">Contact us</Link><Link to="/privacy">Privacy policy</Link><Link to="/terms">Terms of use</Link></div>
        <div><h3>Learning for all</h3><p className="footer-note">Every resource is free to access. Browse, learn and share your knowledge.</p><span className="free-badge"><Check size={14} /> Always free</span></div>
      </div>
      <div className="footer-bottom"><span>© {currentYear} SOMA SMART</span><span>Made for learners, everywhere.</span></div>
    </footer>
  )
}

function ConfigNotice() {
  if (supabaseConfigured) return null
  return (
    <div className="config-notice" role="status">
      <CircleHelp size={18} />
      <p><strong>Connect your library database</strong><br />Add the Supabase URL and anon key to <code>.env.local</code>, then apply the included migration to load live resources.</p>
    </div>
  )
}

function ResourceCover({ resource, large = false }: { resource: Resource; large?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [coverUrl, setCoverUrl] = useState('')
  const [failed, setFailed] = useState(false)
  const [nearViewport, setNearViewport] = useState(large)

  useEffect(() => {
    if (large || !containerRef.current || !resource.cover_image_path) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setNearViewport(true)
        observer.disconnect()
      }
    }, { rootMargin: '120px' })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [large, resource.cover_image_path])

  useEffect(() => {
    let active = true
    if (!resource.cover_image_path || !nearViewport) return
    getSignedCoverUrl(resource.cover_image_path).then((url) => {
      if (active) setCoverUrl(url)
    }).catch((cause: unknown) => {
      console.error('SOMA SMART cover image could not be loaded', cause)
      if (active) setFailed(true)
    })
    return () => { active = false }
  }, [nearViewport, resource.cover_image_path])

  if (large && !resource.cover_image_path) return null
  const className = `resource-placeholder${large ? ' resource-cover-large' : ''}${!large && !nearViewport ? ' resource-cover-pending' : ''}`
  return (
    <div ref={containerRef} className={className}>
      {coverUrl && !failed
        ? <img src={coverUrl} alt={`Cover: ${resource.title}`} loading="lazy" onError={() => setFailed(true)} />
        : <><BookOpen size={31} /><span>{resource.subjects?.name ?? 'Learning resource'}</span></>}
    </div>
  )
}

function ResourceCard({ resource }: { resource: Resource }) {
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const [downloadNotice, setDownloadNotice] = useState('')

  async function download() {
    setDownloading(true)
    setDownloadError('')
    setDownloadNotice('')
    try {
      const tracked = await downloadResourceFile(resource)
      if (!tracked) setDownloadNotice('Download started. The download count may take time to update.')
    } catch (cause) {
      setDownloadError(readableError(cause))
    } finally { setDownloading(false) }
  }

  return (
    <article className="resource-card">
      <Link to={`/resources/${resource.id}`} className="resource-art" aria-label={`Preview ${resource.title}`}>
        <ResourceCover resource={resource} />
        <span className="resource-category">{resource.categories?.name ?? 'Resource'}</span>
      </Link>
      <div className="resource-info">
        <p className="resource-meta">{resource.subjects?.name ?? 'All subjects'} <span>·</span> {resource.class_level ?? resource.academic_level} <span>·</span> {resource.file_format.toUpperCase()}</p>
        <Link className="resource-title" to={`/resources/${resource.id}`}>{resource.title}</Link>
        <div className="resource-card-bottom"><span>{resource.academic_year ?? 'Learning material'}</span></div>
        <div className="resource-card-actions"><Link to={`/resources/${resource.id}`}>Preview <ArrowRight size={14} /></Link><button type="button" onClick={download} disabled={downloading}>{downloading ? 'Preparing…' : 'Download'} <ArrowDownToLine size={14} /></button></div>
        {downloadError && <p className="card-download-error" role="alert">{downloadError}</p>}
        {downloadNotice && <p className="card-download-notice" role="status">{downloadNotice}</p>}
      </div>
    </article>
  )
}

function SelectedCoverPreview({ file, previewUrl }: { file: File | null; previewUrl: string }) {
  if (!file || !previewUrl) return null
  return <img className="selected-cover-preview" src={previewUrl} alt={`Selected cover image: ${file.name}`} />
}

function HomePage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [popularResources, setPopularResources] = useState<Resource[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabaseConfigured) return
    let active = true
    Promise.all([getCategories(), getResources({ limit: 4, sort: 'recent' }), getResources({ limit: 4, sort: 'popular' })])
      .then(([nextCategories, nextResources, nextPopular]) => {
        if (active) {
          setCategories(nextCategories)
          setResources(nextResources.items)
          setPopularResources(nextPopular.items)
        }
      })
      .catch((cause: unknown) => { if (active) setError(readableError(cause)) })
    return () => { active = false }
  }, [])

  return (
    <>
      <section className="hero-section">
        <div className="hero-grid">
          <div className="hero-copy">
            <span className="eyebrow"><Sparkles size={15} /> YOUR KNOWLEDGE, ONE PLATFORM</span>
            <h1>Make room for<br /><em>more possibility.</em></h1>
            <p className="hero-description">The learning resources you need, all in one place. Find textbooks, past papers and study materials — free for every student.</p>
            <div className="hero-actions"><Link className="button button-primary" to="/library">Explore the library <ArrowRight size={17} /></Link><Link className="button button-secondary" to="/about">Discover Soma Smart</Link></div>
            <div className="hero-proof"><span className="proof-icon"><ShieldCheck size={18} /></span><span><strong>Open learning for everyone</strong><small>No fees. No barriers. Just knowledge.</small></span></div>
          </div>
          <div className="hero-visual" aria-label="Books and study resources illustration">
            <div className="visual-orbit orbit-one"></div><div className="visual-orbit orbit-two"></div>
            <div className="visual-sun"></div>
            <div className="floating-label label-top"><span className="mini-icon"><FileText size={17} /></span><span><strong>Past papers</strong><small>Practice with purpose</small></span></div>
            <div className="book-stack">
              <div className="book book-green"><span className="book-symbol">∑</span><span className="book-title">MATHEMATICS</span><span className="book-caption">FORM IV</span></div>
              <div className="book book-cream"><span className="book-symbol">Aa</span><span className="book-title">ENGLISH</span><span className="book-caption">STUDY GUIDE</span></div>
              <div className="book book-orange"><span className="book-symbol">◌</span><span className="book-title">SCIENCE</span><span className="book-caption">EXPLORE MORE</span></div>
              <div className="book-shadow"></div>
            </div>
            <div className="floating-label label-bottom"><span className="mini-icon"><GraduationCap size={19} /></span><span><strong>Ready when you are</strong><small>Learn at your own pace</small></span><span className="status-dot"></span></div>
            <div className="visual-doodle doodle-one">✳</div><div className="visual-doodle doodle-two">✦</div>
          </div>
        </div>
        <div className="hero-bottom"><span><span className="hero-dot"></span> A growing library for Tanzanian learners</span><Link to="/library">Find your next resource <ArrowRight size={15} /></Link></div>
      </section>

      <section className="home-search-section">
        <div className="home-search-copy"><span className="eyebrow eyebrow-dark">START HERE</span><h2>What are you<br />learning today?</h2><p>Search across subjects, classes and resource types.</p></div>
        <LibrarySearch />
      </section>

      <section className="section-wrap category-section">
        <div className="section-heading"><div><span className="eyebrow eyebrow-dark">YOUR LEARNING, YOUR WAY</span><h2>Explore the library</h2><p>Everything you need to feel ready for what’s next.</p></div><Link className="text-link" to="/library">View all resources <ArrowRight size={16} /></Link></div>
        <div className="category-grid">
          {resourceTypes.map(({ title, description, icon: Icon, category }, index) => {
            const match = categories.find((entry) => entry.name.toLowerCase() === category.toLowerCase())
            const count = match?.resource_count
            return <Link className={`category-card category-card-${index + 1}`} to={`/library?category=${encodeURIComponent(category)}`} key={title}>
              <span className="category-icon"><Icon size={22} /></span><span className="category-count">{typeof count === 'number' ? `${count} resources` : 'Explore collection'}</span><strong>{title}</strong><p>{description}</p><span className="category-arrow"><ArrowRight size={18} /></span>
            </Link>
          })}
        </div>
        <div className="other-categories">{categories.filter((category) => !resourceTypes.some((type) => type.category.toLowerCase() === category.name.toLowerCase())).map((category) => <Link key={category.id} to={`/library?category=${encodeURIComponent(category.name)}`}>{category.name}<ArrowRight size={14} /></Link>)}</div>
        {error && <p className="inline-error" role="alert">{error}</p>}
      </section>

      <section className="recent-section">
        <div className="section-wrap">
          <div className="section-heading"><div><span className="eyebrow eyebrow-dark">FRESH FROM THE LIBRARY</span><h2>Recently added</h2><p>New learning materials, ready to explore.</p></div><Link className="text-link" to="/library?sort=recent">Explore the library <ArrowRight size={16} /></Link></div>
          {resources.length > 0
            ? <div className="resource-grid">{resources.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</div>
            : <div className="empty-resources"><span className="empty-icon"><BookOpen size={22} /></span><div><strong>{supabaseConfigured ? 'Your next great resource is on its way.' : 'A whole library is waiting to be connected.'}</strong><p>{supabaseConfigured ? 'Check back soon for new learning materials.' : 'Connect Supabase to publish and discover real learning resources.'}</p></div><Link className="text-link" to="/library">Browse library <ArrowRight size={16} /></Link></div>}
        </div>
      </section>

      {popularResources.length > 0 && <section className="section-wrap category-section popular-section"><div className="section-heading"><div><span className="eyebrow eyebrow-dark">STUDENTS ARE EXPLORING</span><h2>Popular resources</h2><p>Learning materials students are downloading most.</p></div><Link className="text-link" to="/library?sort=popular">See what’s popular <ArrowRight size={16} /></Link></div><div className="resource-grid">{popularResources.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</div></section>}

      <section className="levels-section">
        <div className="levels-inner">
          <div><span className="eyebrow eyebrow-light">BUILT AROUND YOUR JOURNEY</span><h2>Wherever you are,<br /><em>start learning.</em></h2><p>Find the right resources for your level and move forward with confidence.</p><Link className="button button-light" to="/library">Find your resources <ArrowRight size={16} /></Link></div>
          <div className="level-cards">
            <Link className="level-card level-o" to="/library?level=Ordinary%20Level%20%28O-Level%29"><span className="level-card-icon"><BookOpen size={21} /></span><span className="level-label">ORDINARY LEVEL</span><strong>O-Level</strong><span>Forms I – IV</span><ArrowRight className="level-arrow" size={18} /></Link>
            <Link className="level-card level-a" to="/library?level=Advanced%20Level%20%28A-Level%29"><span className="level-card-icon"><GraduationCap size={23} /></span><span className="level-label">ADVANCED LEVEL</span><strong>A-Level</strong><span>Forms V – VI</span><ArrowRight className="level-arrow" size={18} /></Link>
          </div>
          <div className="levels-decoration">S</div>
        </div>
      </section>
      <ConfigNotice />
    </>
  )
}

function LibrarySearch() {
  const [value, setValue] = useState('')
  const navigate = useNavigate()
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    navigate(`/library${value.trim() ? `?q=${encodeURIComponent(value.trim())}` : ''}`)
  }
  return <form className="hero-search" role="search" onSubmit={submit}><span className="search-icon"><Search size={20} /></span><input aria-label="Search by subject, class, title or keyword" placeholder="Try “Form IV biology past papers”" value={value} onChange={(event) => setValue(event.target.value)} /><button className="button button-primary" type="submit">Search library <ArrowRight size={16} /></button><small>Search by subject, class, title or keyword</small></form>
}

function LibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<Resource[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(supabaseConfigured)
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)

  const filters = useMemo(() => ({
    q: searchParams.get('q') ?? '',
    category: searchParams.get('category') ?? '',
    subject: searchParams.get('subject') ?? '',
    level: searchParams.get('level') ?? '',
    classLevel: searchParams.get('class') ?? '',
    year: searchParams.get('year') ?? '',
    sort: searchParams.get('sort') ?? 'recent',
  }), [searchParams])
  const activeCategory = categories.find((category) => category.name === filters.category || category.id === filters.category)

  useEffect(() => {
    if (!supabaseConfigured) return
    let active = true
    Promise.all([
      getResources({ ...filters, page, limit: 12 }),
      getCategories(),
      getSubjects(),
    ]).then(([result, nextCategories, nextSubjects]) => {
      if (!active) return
      setItems(result.items)
      setTotal(result.count)
      setCategories(nextCategories)
      setSubjects(nextSubjects)
    }).catch((cause: unknown) => { if (active) setError(readableError(cause)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [filters, page])

  function changeFilter(key: string, value: string) {
    if ((searchParams.get(key) ?? '') === value) return
    setPage(0)
    setLoading(true)
    setError('')
    const updated = new URLSearchParams(searchParams)
    if (value) updated.set(key, value)
    else updated.delete(key)
    setSearchParams(updated)
  }

  function clearFilters() {
    if (!hasFilters) return
    setPage(0)
    setLoading(true)
    setError('')
    setSearchParams({})
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    changeFilter('q', String(formData.get('q') ?? '').trim())
  }

  const hasFilters = Object.entries(filters).some(([key, value]) => key !== 'sort' && value) || filters.sort !== 'recent'

  return <main className="library-page">
    <div className="page-banner"><div className="section-wrap"><span className="eyebrow eyebrow-dark">{activeCategory ? 'EXPLORE A COLLECTION' : 'THE SOMA SMART LIBRARY'}</span><h1>{activeCategory ? <>{activeCategory.name}<br /><em>for your journey.</em></> : <>Find what moves<br /><em>you forward.</em></>}</h1><p>{activeCategory?.description ?? 'Free textbooks, past papers, notes and more — carefully gathered for your learning journey.'}</p>{activeCategory && <span className="category-total">{activeCategory.resource_count.toLocaleString()} published {activeCategory.resource_count === 1 ? 'resource' : 'resources'}</span>}</div></div>
    <div className="section-wrap library-content">
      <form className="library-search" key={filters.q} role="search" onSubmit={submitSearch}><Search size={19} /><input name="q" defaultValue={filters.q} placeholder="Search titles, subjects or keywords" aria-label="Search resources" /><button className="button button-primary" type="submit">Search</button></form>
      <div className="library-toolbar"><div className="filter-title"><Filter size={17} /><strong>Refine your search</strong></div><span className="result-count">{loading ? 'Searching…' : `${total} ${total === 1 ? 'resource' : 'resources'} found`}</span></div>
      <div className="filter-row">
        <label><span>Category</span><select value={activeCategory?.name ?? ''} onChange={(event) => changeFilter('category', event.target.value)}><option value="">All categories</option>{categories.map((category) => <option value={category.name} key={category.id}>{category.name}</option>)}</select><ChevronDown size={14} /></label>
        <label><span>Subject</span><select value={filters.subject} onChange={(event) => changeFilter('subject', event.target.value)}><option value="">All subjects</option>{subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select><ChevronDown size={14} /></label>
        <label><span>Level</span><select value={filters.level} onChange={(event) => changeFilter('level', event.target.value)}><option value="">All levels</option>{academicLevels.map((level) => <option key={level}>{level}</option>)}</select><ChevronDown size={14} /></label>
        <label><span>Class</span><select value={filters.classLevel} onChange={(event) => changeFilter('class', event.target.value)}><option value="">All classes</option>{classLevels.map((level) => <option key={level}>{level}</option>)}</select><ChevronDown size={14} /></label>
        <label><span>Academic year</span><input className="year-filter" type="number" min="1900" max="2200" step="1" value={filters.year} onChange={(event) => changeFilter('year', event.target.value)} placeholder="e.g. 2025" /></label>
        <label><span>Sort by</span><select value={filters.sort} onChange={(event) => changeFilter('sort', event.target.value)}><option value="recent">Recently added</option><option value="popular">Most downloaded</option><option value="alphabetical">Alphabetical</option></select><ChevronDown size={14} /></label>
      </div>
      {hasFilters && <button className="clear-filters" type="button" onClick={clearFilters}>Clear all filters <X size={14} /></button>}
      {hasFilters && <div className="active-filter-list" aria-label="Active filters">{filters.q && <button type="button" onClick={() => changeFilter('q', '')}>“{filters.q}” <X size={12} /></button>}{activeCategory && <button type="button" onClick={() => changeFilter('category', '')}>{activeCategory.name} <X size={12} /></button>}{filters.subject && <button type="button" onClick={() => changeFilter('subject', '')}>{subjects.find((subject) => subject.id === filters.subject)?.name ?? 'Subject'} <X size={12} /></button>}{filters.level && <button type="button" onClick={() => changeFilter('level', '')}>{filters.level} <X size={12} /></button>}{filters.classLevel && <button type="button" onClick={() => changeFilter('class', '')}>{filters.classLevel} <X size={12} /></button>}{filters.year && <button type="button" onClick={() => changeFilter('year', '')}>{filters.year} <X size={12} /></button>}</div>}
      {!supabaseConfigured && <ConfigNotice />}
      {error && <div className="error-panel" role="alert">{error}</div>}
      {loading ? <div className="loading-grid" aria-label="Loading resources">{Array.from({ length: 6 }, (_, index) => <div className="skeleton-card" key={index}><div></div><span></span><span></span></div>)}</div>
        : items.length ? <div className="resource-grid library-resource-grid">{items.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</div>
          : <div className="library-empty"><span className="empty-icon"><Search size={22} /></span><h2>{supabaseConfigured ? 'No resources found just yet.' : 'Your library will be right here.'}</h2><p>{supabaseConfigured ? 'Try changing your search or clearing one of the filters.' : 'Connect your Supabase project to search and browse published resources.'}</p>{hasFilters && <button className="button button-secondary" type="button" onClick={clearFilters}>Clear filters</button>}</div>}
      {total > 12 && <div className="pagination"><button type="button" disabled={page === 0 || loading} onClick={() => { setLoading(true); setPage((current) => current - 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Previous</button><span>Page {page + 1} of {Math.ceil(total / 12)}</span><button type="button" disabled={(page + 1) * 12 >= total || loading} onClick={() => { setLoading(true); setPage((current) => current + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Next</button></div>}
    </div>
  </main>
}

function ResourcePage() {
  const { id = '' } = useParams()
  const [resource, setResource] = useState<Resource | null>(null)
  const [signedUrl, setSignedUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(supabaseConfigured)
  const [downloading, setDownloading] = useState(false)
  const [downloadNotice, setDownloadNotice] = useState('')
  const [relatedResources, setRelatedResources] = useState<Resource[]>([])
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('Broken or unavailable file')
  const [reportDescription, setReportDescription] = useState('')
  const [reportMessage, setReportMessage] = useState('')
  const [reportBusy, setReportBusy] = useState(false)

  useEffect(() => {
    let active = true
    if (!supabaseConfigured) return
    getResource(id).then(async (item) => {
      if (!item) return
      const url = await getSignedFileUrl(item.file_path)
      if (active) { setResource(item); setSignedUrl(url) }
      if (active) {
        const [byCategory, bySubject] = await Promise.all([
          getResources({ category: item.category_id, limit: 4, sort: 'popular' }),
          item.subject_id ? getResources({ subject: item.subject_id, limit: 4, sort: 'popular' }) : Promise.resolve({ items: [], count: 0 }),
        ])
        const recommendations = new Map([...byCategory.items, ...bySubject.items].filter((candidate) => candidate.id !== item.id).map((candidate) => [candidate.id, candidate]))
        if (active) setRelatedResources([...recommendations.values()].slice(0, 3))
      }
    }).catch((cause: unknown) => { if (active) setError(readableError(cause)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  async function download() {
    if (!resource) return
    setDownloading(true)
    setError('')
    setDownloadNotice('')
    try {
      const tracked = await downloadResourceFile(resource)
      if (!tracked) setDownloadNotice('Download started. The download count may take time to update.')
    } catch (cause) {
      setError(readableError(cause))
    } finally { setDownloading(false) }
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!resource) return
    setReportBusy(true)
    setReportMessage('')
    try {
      await createReport(resource.id, reportReason, reportDescription)
      setReportMessage('Thank you. Your report has been sent to the library team.')
      setReportDescription('')
      setReportOpen(false)
    } catch (cause) { setReportMessage(readableError(cause)) }
    finally { setReportBusy(false) }
  }

  if (loading) return <main className="center-state"><LoaderCircle className="spinner" size={30} /><p>Opening resource…</p></main>
  if (!resource) return <main className="center-state"><span className="empty-icon"><BookOpen size={22} /></span><h1>{error ? 'This resource is unavailable.' : 'Resource not found.'}</h1><p>{error || 'It may have been removed or is not published yet.'}</p><Link className="button button-primary" to="/library">Back to the library <ArrowRight size={16} /></Link></main>

  const isPdf = resource.file_format.toLowerCase() === 'pdf'
  return <main className="detail-page section-wrap">
    <Link className="back-link" to="/library">← Back to the library</Link>
    <div className="detail-layout">
      <div className="detail-main">
        <div className="detail-kicker">{resource.categories?.name ?? 'Learning resource'} <span>·</span> {resource.subjects?.name ?? 'All subjects'}</div>
        <h1>{resource.title}</h1>
        <p className="detail-description">{resource.description || 'A learning resource selected to support your studies.'}</p>
        <div className="detail-facts"><span>{resource.academic_level}</span>{resource.class_level && <span>{resource.class_level}</span>}{resource.academic_year && <span>{resource.academic_year}</span>}</div>
        {resource.cover_image_path && <ResourceCover resource={resource} large />}
        <div className="document-frame">
          {isPdf ? <Suspense fallback={<div className="pdf-state"><LoaderCircle className="spinner" size={22} /> Loading PDF viewer…</div>}><PdfPreview file={signedUrl} title={resource.title} /></Suspense> : <div className="download-preview"><span className="empty-icon"><FileText size={25} /></span><strong>Preview not available for {resource.file_format.toUpperCase()} files</strong><p>Download this file to open it in a compatible app on your device.</p><button className="button button-primary" type="button" onClick={download} disabled={downloading}>{downloading ? 'Preparing download…' : 'Download file'} <ArrowDownToLine size={17} /></button></div>}
        </div>
        {error && <p className="inline-error" role="alert">{error}</p>}{downloadNotice && <p className="report-message" role="status">{downloadNotice}</p>}
      </div>
      <aside className="detail-sidebar"><span className="eyebrow eyebrow-dark">RESOURCE DETAILS</span><h2>Ready to learn?</h2><p>Preview the document, then save it for your studies.</p><button className="button button-primary detail-download" type="button" onClick={download} disabled={downloading}>{downloading ? 'Preparing…' : 'Download for free'} <ArrowDownToLine size={17} /></button><div className="detail-stat"><span>Subject</span><strong>{resource.subjects?.name ?? 'Not specified'}</strong></div><div className="detail-stat"><span>Academic level</span><strong>{resource.academic_level}</strong></div>{resource.class_level && <div className="detail-stat"><span>Class</span><strong>{resource.class_level}</strong></div>}<div className="detail-stat"><span>Format · size</span><strong>{resource.file_format.toUpperCase()} · {formatFileSize(resource.file_size)}</strong></div><div className="detail-stat"><span>Downloads</span><strong>{resource.download_count.toLocaleString()}</strong></div><div className="detail-stat"><span>Date uploaded</span><strong>{new Date(resource.created_at).toLocaleDateString()}</strong></div>{resource.author && <div className="detail-stat"><span>Author</span><strong>{resource.author}</strong></div>}{resource.publisher && <div className="detail-stat"><span>Publisher</span><strong>{resource.publisher}</strong></div>}<p className="free-note"><ShieldCheck size={16} /> Free to access. Always.</p><button className="report-button" type="button" onClick={() => setReportOpen((open) => !open)}><Flag size={14} /> Report a problem</button>{reportMessage && <p className="report-message" role="status">{reportMessage}</p>}{reportOpen && <form className="report-form" onSubmit={submitReport}><label>What’s wrong?<select value={reportReason} onChange={(event) => setReportReason(event.target.value)}><option>Broken or unavailable file</option><option>Incorrect resource information</option><option>Copyright or licensing concern</option><option>Other</option></select></label><label>Details<textarea value={reportDescription} onChange={(event) => setReportDescription(event.target.value)} rows={3} maxLength={2000} placeholder="Tell us a little more (optional)" /></label><button className="button button-primary" disabled={reportBusy}>{reportBusy ? 'Sending…' : 'Send report'}</button></form>}</aside>
    </div>
    {relatedResources.length > 0 && <section className="related-resources"><div className="section-heading"><div><span className="eyebrow eyebrow-dark">KEEP EXPLORING</span><h2>Related resources</h2><p>More materials selected for your studies.</p></div><Link className="text-link" to={`/library?category=${encodeURIComponent(resource.category_id)}`}>Browse this category <ArrowRight size={16} /></Link></div><div className="resource-grid">{relatedResources.map((item) => <ResourceCard key={item.id} resource={item} />)}</div></section>}
  </main>
}

function AboutPage() {
  return <main className="info-page section-wrap"><span className="eyebrow eyebrow-dark">OUR PURPOSE</span><h1>Knowledge opens<br /><em>every door.</em></h1><p>SOMA SMART is a free digital library built to make quality learning materials easier to find for secondary school students in Tanzania. We bring textbooks, revision notes and examination practice together in one welcoming place.</p><div className="info-callout"><span className="category-icon"><GraduationCap size={22} /></span><div><strong>Learning belongs to everyone.</strong><p>Our goal is simple: remove barriers between curious students and the resources that help them thrive.</p></div></div><Link className="button button-primary" to="/library">Explore the library <ArrowRight size={17} /></Link></main>
}

function ContactPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [formMessage, setFormMessage] = useState('')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    setFormMessage('')
    if (!supabaseConfigured) {
      setFormError('Contact form storage is not configured yet. Please try again later.')
      return
    }
    setBusy(true)
    try {
      await submitContactMessage({ fullName, email, subject, message })
      setFormMessage('Your message was received. Our team will review it.')
      setFullName('')
      setEmail('')
      setSubject('')
      setMessage('')
    } catch (cause) {
      setFormError(readableError(cause))
    } finally { setBusy(false) }
  }

  return <main className="info-page section-wrap"><span className="eyebrow eyebrow-dark">WE’RE HERE TO HELP</span><h1>Get in<br /><em>touch.</em></h1><p>Have a question about using SOMA SMART or a resource in our library? Send our team a message.</p>
    <form className="contact-form" onSubmit={submit}><div className="contact-form-row"><label>Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={2} maxLength={120} autoComplete="name" /></label><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} autoComplete="email" /></label></div><label>Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} required minLength={2} maxLength={160} /></label><label>Message<textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={6} required minLength={5} maxLength={4000} /></label>{formError && <p className="inline-error" role="alert">{formError}</p>}{formMessage && <p className="success-message" role="status"><Check size={16} /> {formMessage}</p>}<button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Sending message…' : 'Send message'} <ArrowRight size={16} /></button><small>Messages are visible only to authorized administrators after submission. Email delivery is not configured by default.</small></form>
    {contactEmail && <a className="contact-card" href={`mailto:${contactEmail}`}><span className="category-icon"><BookOpen size={21} /></span><span><small>EMAIL OUR TEAM</small><strong>{contactEmail}</strong></span><ArrowRight size={18} /></a>}<p className="contact-small">SOMA SMART administrators review learning resources before publication.</p></main>
}

function PrivacyPage() {
  return <main className="info-page section-wrap"><span className="eyebrow eyebrow-dark">YOUR INFORMATION</span><h1>Privacy<br /><em>at SOMA SMART.</em></h1><p>SOMA SMART uses Supabase Authentication for administrator sign-in and stores administrator profile details needed to manage the library. Students can browse published resources without creating an account.</p><div className="info-callout"><span className="category-icon"><ShieldCheck size={21} /></span><div><strong>Resource access and downloads</strong><p>When a published resource download is initiated, the platform records its resource identifier and timestamp to maintain download statistics. The public website does not ask students for names, emails or passwords.</p></div></div><p>Learning files are stored in a private Supabase Storage bucket and made available using short-lived signed links. The hosting and Supabase providers process requests needed to operate the service. The site owner should review and update this notice before public launch to include the final operator contact, retention practices and any applicable local legal requirements.</p></main>
}

function TermsPage() {
  return <main className="info-page section-wrap"><span className="eyebrow eyebrow-dark">USING THE LIBRARY</span><h1>Terms of<br /><em>use.</em></h1><p>SOMA SMART provides free access to published educational materials for learning and revision. Resources are supplied for personal educational use; respect the original authors' and publishers' rights and any notices included with each document.</p><div className="info-callout"><span className="category-icon"><BookOpen size={21} /></span><div><strong>Free access, responsible use</strong><p>Do not misuse the service, attempt to access unpublished files, or upload content unless you are an authorized administrator. The site owner should verify the final terms and any licensing requirements before public launch.</p></div></div></main>
}

function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!supabase) { setError('Administrator login is not configured. Add the Supabase settings first.'); return }
    setBusy(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (authError) { console.error('SOMA SMART administrator sign-in failed', authError); setError('Sign-in failed. Check your email and password, then try again.'); return }
    navigate('/admin')
  }

  return <main className="login-page"><form className="login-card" onSubmit={login}><span className="login-logo"><LockKeyhole size={21} /></span><span className="eyebrow eyebrow-dark">SOMA SMART ADMINISTRATION</span><h1>Welcome back.</h1><p>Sign in with your authorized administrator account.</p><label>Email address<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <p className="inline-error" role="alert">{error}</p>}<button className="button button-primary login-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'} <ArrowRight size={16} /></button><Link className="back-link" to="/">← Back to SOMA SMART</Link></form></main>
}

function AdminPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(supabaseConfigured ? null : false)
  const [resources, setResources] = useState<Resource[]>([])
  const [dashboardStats, setDashboardStats] = useState({ total_resources: 0, published_resources: 0, draft_resources: 0, total_downloads: 0, textbook_resources: 0, past_papers: 0, study_notes: 0 })
  const [reports, setReports] = useState<ResourceReport[]>([])
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([])
  const [adminProfiles, setAdminProfiles] = useState<AdminProfile[]>([])
  const [currentProfileId, setCurrentProfileId] = useState('')
  const [settingsName, setSettingsName] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [level, setLevel] = useState(academicLevels[0])
  const [classLevel, setClassLevel] = useState('Form I')
  const [year, setYear] = useState('')
  const [author, setAuthor] = useState('')
  const [publisher, setPublisher] = useState('')
  const [keywords, setKeywords] = useState('')
  const [published, setPublished] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [editingResource, setEditingResource] = useState<Resource | null>(null)
  const [managementBusy, setManagementBusy] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [categoryDescription, setCategoryDescription] = useState('')
  const [subjectName, setSubjectName] = useState('')
  const [subjectLevel, setSubjectLevel] = useState(academicLevels[0])
  const [managementQuery, setManagementQuery] = useState('')
  const [coverImage, setCoverImage] = useState<File | null>(null)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState('')
  const [removeExistingCover, setRemoveExistingCover] = useState(false)
  const availableClasses = level === academicLevels[0] ? classLevels.slice(0, 4) : classLevels.slice(4)
  const availableSubjects = subjects.filter((subject) => subject.academic_level === level && (subject.is_active || subject.id === subjectId))

  async function loadDashboard() {
    if (!supabase) return
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) { console.error('SOMA SMART administrator identity lookup failed', userError); setError('Administrator access could not be verified. Please sign in again.'); setIsAdmin(false); return }
    if (!user) { setIsAdmin(false); return }
    const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profileError) { console.error('SOMA SMART administrator profile lookup failed', profileError); setError('Administrator access could not be verified. Please sign in again.'); setIsAdmin(false); return }
    if (profile?.role !== 'admin') { setIsAdmin(false); return }
    try {
      const [result, nextCategories, nextSubjects, nextStats, nextReports, nextContactMessages, nextProfiles] = await Promise.all([
        getResources({ limit: 1000, includeUnpublished: true, sort: 'recent' }),
        getCategories(true),
        getSubjects(true),
        getAdminDashboardStats(),
        getReports(),
        getContactMessages(),
        getAdminProfiles(),
      ])
      setResources(result.items)
      setCategories(nextCategories)
      setSubjects(nextSubjects)
      setDashboardStats(nextStats)
      setReports(nextReports)
      setContactMessages(nextContactMessages)
      setAdminProfiles(nextProfiles)
      setCurrentProfileId(user.id)
      setSettingsName(nextProfiles.find((profile) => profile.id === user.id)?.full_name ?? '')
      setIsAdmin(true)
    } catch (cause) { setError(readableError(cause)); setIsAdmin(true) }
  }

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ error: sessionError }) => {
      if (sessionError) {
        console.error('SOMA SMART session lookup failed', sessionError)
        setError('Administrator access could not be verified. Please sign in again.')
        setIsAdmin(false)
        return
      }
      return loadDashboard()
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void loadDashboard() })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => () => {
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl)
  }, [coverPreviewUrl])

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!supabase) { setError('Supabase is not configured.'); return }
    if (!editingResource && !file) { setError('Choose a PDF, DOCX or PPTX document to upload.'); return }
    if (file && file.size > maxUploadBytes) { setError('The selected document is larger than the 50 MB limit.'); return }
    setBusy(true)
    try {
      const details = {
        title, description, categoryId, subjectId, academicLevel: level,
        classLevel, academicYear: year ? Number(year) : null, author, publisher,
        keywords: keywords.split(',').map((keyword) => keyword.trim()).filter(Boolean), published,
      }
      if (editingResource) {
        await updateResource(editingResource, { ...details, file: file ?? undefined, coverImage, removeCover: removeExistingCover })
        setMessage(`“${title}” was updated successfully.`)
      } else {
        if (!file) throw new Error('Choose a document to upload.')
        const result = await addResource({ ...details, file, coverImage })
        setMessage(`“${result.title}” was uploaded successfully.`)
      }
      setEditingResource(null)
      setTitle(''); setDescription(''); setCategoryId(''); setSubjectId(''); setYear(''); setAuthor(''); setPublisher(''); setKeywords(''); setFile(null); setCoverImage(null); setCoverPreviewUrl(''); setRemoveExistingCover(false); setPublished(false)
      const input = document.getElementById('document-file') as HTMLInputElement | null
      if (input) input.value = ''
      const coverInput = document.getElementById('cover-file') as HTMLInputElement | null
      if (coverInput) coverInput.value = ''
      await loadDashboard()
    } catch (cause) { setError(readableError(cause)) }
    finally { setBusy(false) }
  }

  function edit(resource: Resource) {
    setEditingResource(resource)
    setTitle(resource.title)
    setDescription(resource.description ?? '')
    setCategoryId(resource.category_id)
    setSubjectId(resource.subject_id ?? '')
    setLevel(resource.academic_level)
    setClassLevel(resource.class_level ?? 'Form I')
    setYear(resource.academic_year?.toString() ?? '')
    setAuthor(resource.author ?? '')
    setPublisher(resource.publisher ?? '')
    setKeywords(resource.keywords.join(', '))
    setPublished(resource.status === 'published')
    setFile(null)
    setCoverImage(null)
    setCoverPreviewUrl('')
    setRemoveExistingCover(false)
    document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function cancelEdit() {
    setEditingResource(null)
    setTitle(''); setDescription(''); setCategoryId(''); setSubjectId(''); setYear(''); setAuthor(''); setPublisher(''); setKeywords(''); setFile(null); setCoverImage(null); setCoverPreviewUrl(''); setRemoveExistingCover(false); setPublished(false)
    const input = document.getElementById('document-file') as HTMLInputElement | null
    if (input) input.value = ''
    const coverInput = document.getElementById('cover-file') as HTMLInputElement | null
    if (coverInput) coverInput.value = ''
  }

  async function togglePublished(resource: Resource) {
    try {
      setError('')
      await setResourcePublished(resource.id, resource.status !== 'published')
      await loadDashboard()
    } catch (cause) { setError(readableError(cause)) }
  }

  async function remove(resource: Resource) {
    if (!window.confirm(`Permanently delete “${resource.title}” and its stored files? This cannot be undone.`)) return
    try {
      setError('')
      await deleteResource(resource)
      setResources((current) => current.filter((entry) => entry.id !== resource.id))
      setMessage(`“${resource.title}” was deleted.`)
    } catch (cause) { setError(readableError(cause)) }
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setManagementBusy(true)
    setError('')
    try {
      await createCategory(categoryName, categoryDescription)
      setCategoryName('')
      setCategoryDescription('')
      await loadDashboard()
      setMessage('Category added.')
    } catch (cause) { setError(readableError(cause)) }
    finally { setManagementBusy(false) }
  }

  async function removeCategoryEntry(category: Category) {
    if (!window.confirm(`Remove the “${category.name}” category? Categories assigned to resources cannot be removed.`)) return
    try {
      await removeCategory(category.id)
      await loadDashboard()
      setMessage(`“${category.name}” category removed.`)
    } catch (cause) { setError(readableError(cause)) }
  }

  async function toggleCategory(category: Category) {
    try {
      await setCategoryActive(category.id, !category.is_active)
      await loadDashboard()
      setMessage(`“${category.name}” ${category.is_active ? 'deactivated' : 'activated'}.`)
    } catch (cause) { setError(readableError(cause)) }
  }

  async function saveSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setManagementBusy(true)
    setError('')
    try {
      await createSubject(subjectName, subjectLevel)
      setSubjectName('')
      await loadDashboard()
      setMessage('Subject added.')
    } catch (cause) { setError(readableError(cause)) }
    finally { setManagementBusy(false) }
  }

  async function toggleSubject(subject: Subject) {
    try {
      await setSubjectActive(subject.id, !subject.is_active)
      await loadDashboard()
    } catch (cause) { setError(readableError(cause)) }
  }

  async function changeReportStatus(report: ResourceReport, status: ResourceReport['status']) {
    try {
      await setReportStatus(report.id, status)
      setReports((current) => current.map((item) => item.id === report.id ? { ...item, status } : item))
    } catch (cause) { setError(readableError(cause)) }
  }

  async function changeContactStatus(contact: ContactMessage, status: ContactMessage['status']) {
    try {
      await setContactMessageStatus(contact.id, status)
      setContactMessages((current) => current.map((item) => item.id === contact.id ? { ...item, status } : item))
    } catch (cause) { setError(readableError(cause)) }
  }

  function handleContactStatusChange(contact: ContactMessage, value: string) {
    switch (value) {
      case 'new': void changeContactStatus(contact, 'new'); break
      case 'reviewing': void changeContactStatus(contact, 'reviewing'); break
      case 'resolved': void changeContactStatus(contact, 'resolved'); break
      default: setError('Unsupported contact message status.')
    }
  }

  function handleReportStatusChange(report: ResourceReport, value: string) {
    switch (value) {
      case 'open': void changeReportStatus(report, 'open'); break
      case 'reviewing': void changeReportStatus(report, 'reviewing'); break
      case 'resolved': void changeReportStatus(report, 'resolved'); break
      case 'dismissed': void changeReportStatus(report, 'dismissed'); break
      default: setError('Unsupported report status.')
    }
  }

  async function changeProfileRole(profile: AdminProfile) {
    if (profile.id === currentProfileId) {
      setError('You cannot change your own administrator role.')
      return
    }
    const nextRole = profile.role === 'admin' ? 'student' : 'admin'
    if (!window.confirm(`${nextRole === 'admin' ? 'Grant administrator access to' : 'Remove administrator access from'} ${profile.full_name || profile.id}?`)) return
    try {
      await setProfileRole(profile.id, nextRole)
      setAdminProfiles((current) => current.map((item) => item.id === profile.id ? { ...item, role: nextRole } : item))
      setMessage(`Account role changed to ${nextRole}.`)
    } catch (cause) { setError(readableError(cause)) }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      await setAdminProfileName(settingsName)
      setMessage('Your administrator profile was updated.')
    } catch (cause) { setError(readableError(cause)) }
  }

  async function signOut() {
    if (!supabase) return
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) { console.error('SOMA SMART administrator sign-out failed', signOutError); setError('Sign out failed. Please try again.') }
  }

  if (isAdmin === null) return <main className="center-state"><LoaderCircle className="spinner" size={30} /><p>Verifying administrator access…</p></main>
  if (!isAdmin) return <Navigate to={supabaseConfigured ? '/admin/login' : '/'} replace />

  const visibleResources = resources.filter((resource) => {
    const text = `${resource.title} ${resource.description ?? ''} ${resource.keywords.join(' ')} ${resource.categories?.name ?? ''} ${resource.subjects?.name ?? ''}`.toLowerCase()
    return text.includes(managementQuery.trim().toLowerCase())
  })
  return <main className="admin-page">
    <aside className="admin-sidebar"><Link className="brand" to="/"><span className="brand-mark"><BookOpenCheck size={23} /></span><span className="brand-copy"><strong>SOMA<span>SMART</span></strong><small>ADMINISTRATION</small></span></Link><span className="admin-nav-label">WORKSPACE</span><a className="admin-nav active" href="#overview"><LibraryBig size={17} /> Dashboard</a><a className="admin-nav" href="#upload"><Upload size={17} /> Upload resource</a><a className="admin-nav" href="#manage"><BookOpen size={17} /> Manage resources</a><a className="admin-nav" href="#manage-taxonomy"><Layers3 size={17} /> Categories & subjects</a><a className="admin-nav" href="#reports"><Flag size={17} /> Reports</a><a className="admin-nav" href="#messages"><CircleHelp size={17} /> Contact messages</a><a className="admin-nav" href="#administrators"><ShieldCheck size={17} /> Administrators</a><a className="admin-nav" href="#settings"><LockKeyhole size={17} /> Settings</a><button className="admin-nav admin-logout" type="button" onClick={signOut}><X size={17} /> Logout</button><span className="admin-sidebar-bottom"><ShieldCheck size={16} /> Authorized administrators only</span></aside>
    <section className="admin-main">
      <header className="admin-topbar"><div><span className="eyebrow eyebrow-dark">SOMA SMART / ADMIN</span><h1>Library overview</h1></div><button className="button button-secondary" type="button" onClick={signOut}>Sign out</button></header>
      {error && <p className="inline-error" role="alert">{error}</p>}{message && <p className="success-message" role="status"><Check size={16} /> {message}</p>}
      <div className="admin-stats" id="overview"><div><span><LibraryBig size={17} /></span><small>Total resources</small><strong>{dashboardStats.total_resources.toLocaleString()}</strong></div><div><span><Check size={17} /></span><small>Published</small><strong>{dashboardStats.published_resources.toLocaleString()}</strong></div><div><span><FileText size={17} /></span><small>Drafts</small><strong>{dashboardStats.draft_resources.toLocaleString()}</strong></div><div><span><ArrowDownToLine size={17} /></span><small>Total downloads</small><strong>{dashboardStats.total_downloads.toLocaleString()}</strong></div><div><span><BookOpen size={17} /></span><small>Textbooks</small><strong>{dashboardStats.textbook_resources.toLocaleString()}</strong></div><div><span><FileText size={17} /></span><small>Past papers</small><strong>{dashboardStats.past_papers.toLocaleString()}</strong></div><div><span><BookText size={17} /></span><small>Study notes</small><strong>{dashboardStats.study_notes.toLocaleString()}</strong></div></div>
      <div className="admin-columns">
        <form className="admin-form-card" id="upload" onSubmit={upload}>
          <div className="admin-card-heading"><div><span className="eyebrow eyebrow-dark">{editingResource ? 'EDIT YOUR RESOURCE' : 'ADD TO THE LIBRARY'}</span><h2>{editingResource ? 'Edit resource' : 'Upload a resource'}</h2></div><Upload size={19} /></div>
          <label>Resource title<input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={180} /></label>
          <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={4000} /></label>
          <label>Keywords (comma separated)<input value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="e.g. algebra, revision, NECTA" /></label>
          <div className="form-two-col"><label>Category<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required><option value="">Choose category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Subject<select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">Choose subject (optional)</option>{availableSubjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select></label></div>
          <div className="form-two-col"><label>Academic level<select value={level} onChange={(event) => { const nextLevel = event.target.value; setLevel(nextLevel); if (subjects.find((subject) => subject.id === subjectId)?.academic_level !== nextLevel) setSubjectId(''); setClassLevel(nextLevel === academicLevels[0] ? 'Form I' : 'Form V') }}>{academicLevels.map((item) => <option key={item}>{item}</option>)}</select></label><label>Class<select value={classLevel} onChange={(event) => setClassLevel(event.target.value)}>{availableClasses.map((item) => <option key={item}>{item}</option>)}</select></label></div>
          <div className="form-two-col"><label>Academic year<input type="number" min="1900" max="2200" value={year} onChange={(event) => setYear(event.target.value)} placeholder="e.g. 2025" /></label><label>Author<input value={author} onChange={(event) => setAuthor(event.target.value)} maxLength={160} /></label></div>
          <label>Publisher<input value={publisher} onChange={(event) => setPublisher(event.target.value)} maxLength={160} /></label>
          <label className="file-picker" htmlFor="document-file"><Upload size={19} /><span><strong>{file?.name ?? (editingResource ? `Keep current ${editingResource.file_format.toUpperCase()} document or choose a replacement` : 'Choose a learning document')}</strong><small>{file ? `${formatFileSize(file.size)} · ` : ''}PDF, DOCX or PPTX · up to 50 MB</small></span><input id="document-file" type="file" accept=".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required={!editingResource} /></label>
          <label className="file-picker" htmlFor="cover-file"><BookOpen size={19} /><span><strong>{coverImage?.name ?? (editingResource?.cover_image_path && !removeExistingCover ? 'Keep current cover image or choose a replacement' : 'Choose an optional cover image')}</strong><small>{coverImage ? `${formatFileSize(coverImage.size)} · ` : ''}JPG, PNG or WEBP · up to 5 MB</small></span><input id="cover-file" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={(event) => { const selected = event.target.files?.[0] ?? null; setCoverImage(selected); setCoverPreviewUrl(selected ? URL.createObjectURL(selected) : ''); setRemoveExistingCover(false) }} /></label><SelectedCoverPreview file={coverImage} previewUrl={coverPreviewUrl} />
          {editingResource?.cover_image_path && !coverImage && <button className="cover-remove" type="button" aria-pressed={removeExistingCover} onClick={() => setRemoveExistingCover((remove) => !remove)}>{removeExistingCover ? 'Keep current cover image' : 'Remove current cover image'}</button>}
          <label className="publish-option"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /><span><strong>Publish immediately</strong><small>Leave unchecked to save as an unpublished draft.</small></span></label>
          <button className="button button-primary upload-submit" disabled={busy}>{busy ? 'Saving resource…' : editingResource ? 'Save changes' : 'Upload resource'} <ArrowRight size={16} /></button>
          {editingResource && <button className="button button-secondary upload-submit" type="button" onClick={cancelEdit}>Cancel editing</button>}
        </form>
        <section className="admin-resources" id="manage">
          <div className="admin-card-heading"><div><span className="eyebrow eyebrow-dark">YOUR COLLECTION</span><h2>Manage resources</h2></div><span className="admin-total">{resources.length}</span></div>
          <label className="admin-resource-search"><Search size={16} /><input value={managementQuery} onChange={(event) => setManagementQuery(event.target.value)} placeholder="Search resources by title, subject or keyword" aria-label="Search administrator resources" /></label>
          {visibleResources.length ? <div className="admin-resource-list">{visibleResources.map((resource) => <article className="admin-resource-row" key={resource.id}>
            <span className="admin-file-icon"><FileText size={18} /></span><div className="admin-resource-copy"><strong>{resource.title}</strong><small>{resource.categories?.name ?? 'Uncategorized'} · {resource.file_format.toUpperCase()}</small></div>
            <span className={`status-pill${resource.status === 'published' ? ' status-live' : ''}`}>{resource.status === 'published' ? 'Published' : 'Draft'}</span>
            <button className="table-action" type="button" onClick={() => edit(resource)}>Edit</button>
            <button className="table-action" type="button" onClick={() => void togglePublished(resource)}>{resource.status === 'published' ? 'Unpublish' : 'Publish'}</button>
            <button className="table-action table-delete" type="button" onClick={() => void remove(resource)} aria-label={`Delete ${resource.title}`}>Delete</button>
          </article>)}</div> : <div className="admin-empty"><FileText size={24} /><p>Your resources will appear here after upload.</p></div>}
        </section>
      </div>
      <section className="taxonomy-grid" id="manage-taxonomy">
        <div className="taxonomy-card"><div className="admin-card-heading"><div><span className="eyebrow eyebrow-dark">ORGANIZE THE LIBRARY</span><h2>Manage categories</h2></div><Layers3 size={19} /></div>
          <form className="taxonomy-form" onSubmit={saveCategory}><label>Category name<input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} required maxLength={80} /></label><label>Description<input value={categoryDescription} onChange={(event) => setCategoryDescription(event.target.value)} maxLength={240} /></label><button className="button button-primary" disabled={managementBusy}>Add category <ArrowRight size={15} /></button></form>
          <div className="taxonomy-list">{categories.map((category) => <div className="taxonomy-item" key={category.id}><span><strong>{category.name}</strong><small>{category.resource_count} resources · {category.is_active ? 'Active' : 'Inactive'}</small></span><button className="table-action" type="button" onClick={() => void toggleCategory(category)}>{category.is_active ? 'Deactivate' : 'Activate'}</button><button className="table-action table-delete" type="button" onClick={() => void removeCategoryEntry(category)} aria-label={`Remove ${category.name}`}>Remove</button></div>)}</div>
        </div>
        <div className="taxonomy-card"><div className="admin-card-heading"><div><span className="eyebrow eyebrow-dark">SUBJECT DIRECTORY</span><h2>Manage subjects</h2></div><GraduationCap size={20} /></div>
          <form className="taxonomy-form" onSubmit={saveSubject}><label>Subject name<input value={subjectName} onChange={(event) => setSubjectName(event.target.value)} required maxLength={80} /></label><label>Academic level<select value={subjectLevel} onChange={(event) => setSubjectLevel(event.target.value)}>{academicLevels.map((item) => <option key={item}>{item}</option>)}</select></label><button className="button button-primary" disabled={managementBusy}>Add subject <ArrowRight size={15} /></button></form>
          <div className="taxonomy-list">{subjects.map((subject) => <div className="taxonomy-item" key={subject.id}><span><strong>{subject.name}</strong><small>{subject.academic_level} · {subject.is_active ? 'Active' : 'Inactive'}</small></span><button className="table-action" type="button" onClick={() => void toggleSubject(subject)}>{subject.is_active ? 'Deactivate' : 'Activate'}</button></div>)}</div>
        </div>
      </section>
      <section className="admin-resources report-list-section" id="reports"><div className="admin-card-heading"><div><span className="eyebrow eyebrow-dark">STUDENT FEEDBACK</span><h2>Resource reports</h2></div><span className="admin-total">{reports.length}</span></div>{reports.length ? <div className="admin-resource-list">{reports.map((report) => <article className="report-row" key={report.id}><div className="report-copy"><strong>{report.resources?.title ?? 'Removed resource'}</strong><small>{report.reason} · {new Date(report.created_at).toLocaleDateString()}</small>{report.description && <p>{report.description}</p>}</div><select aria-label={`Status for report about ${report.resources?.title ?? 'resource'}`} value={report.status} onChange={(event) => handleReportStatusChange(report, event.target.value)}><option value="open">Open</option><option value="reviewing">Reviewing</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select></article>)}</div> : <div className="admin-empty"><Flag size={22} /><p>No student reports yet.</p></div>}</section>
      <section className="admin-resources report-list-section" id="messages"><div className="admin-card-heading"><div><span className="eyebrow eyebrow-dark">STUDENT ENQUIRIES</span><h2>Contact messages</h2></div><span className="admin-total">{contactMessages.length}</span></div>{contactMessages.length ? <div className="admin-resource-list">{contactMessages.map((contact) => <article className="report-row" key={contact.id}><div className="report-copy"><strong>{contact.subject}</strong><small>{contact.full_name} · <a href={`mailto:${contact.email}`}>{contact.email}</a> · {new Date(contact.created_at).toLocaleDateString()}</small><p>{contact.message}</p></div><select aria-label={`Status for contact message ${contact.subject}`} value={contact.status} onChange={(event) => handleContactStatusChange(contact, event.target.value)}><option value="new">New</option><option value="reviewing">Reviewing</option><option value="resolved">Resolved</option></select></article>)}</div> : <div className="admin-empty"><CircleHelp size={22} /><p>No contact messages yet.</p></div>}</section>
      <section className="admin-resources report-list-section" id="administrators"><div className="admin-card-heading"><div><span className="eyebrow eyebrow-dark">ACCESS CONTROL</span><h2>Administrator management</h2></div><span className="admin-total">{adminProfiles.filter((profile) => profile.role === 'admin').length}</span></div><p className="admin-help">Create user accounts through Supabase Authentication. Here, administrators can grant or remove administrator access for existing profiles. Role changes are protected by database authorization.</p><div className="admin-resource-list">{adminProfiles.map((profile) => <article className="admin-resource-row" key={profile.id}><span className="admin-file-icon"><ShieldCheck size={17} /></span><div className="admin-resource-copy"><strong>{profile.full_name || 'Unnamed account'}{profile.id === currentProfileId ? ' (you)' : ''}</strong><small>{profile.id} · joined {new Date(profile.created_at).toLocaleDateString()}</small></div><span className={`status-pill${profile.role === 'admin' ? ' status-live' : ''}`}>{profile.role}</span>{profile.id !== currentProfileId && <button className="table-action" type="button" onClick={() => void changeProfileRole(profile)}>{profile.role === 'admin' ? 'Revoke admin' : 'Make admin'}</button>}</article>)}</div></section>
      <section className="admin-form-card admin-settings" id="settings"><div className="admin-card-heading"><div><span className="eyebrow eyebrow-dark">ACCOUNT PREFERENCES</span><h2>Administrator settings</h2></div><LockKeyhole size={19} /></div><form className="settings-form" onSubmit={saveSettings}><label>Display name<input value={settingsName} onChange={(event) => setSettingsName(event.target.value)} required minLength={2} maxLength={120} /></label><p>Your password is managed securely by Supabase Authentication and cannot be changed here.</p><button className="button button-primary">Save profile</button></form></section>
    </section>
  </main>
}

export default function App() {
  const { pathname } = useLocation()
  const isAdminRoute = pathname.startsWith('/admin')
  return <>{!isAdminRoute && <Header />}<Routes><Route path="/" element={<HomePage />} /><Route path="/library" element={<LibraryPage />} /><Route path="/resources/:id" element={<ResourcePage />} /><Route path="/about" element={<AboutPage />} /><Route path="/contact" element={<ContactPage />} /><Route path="/privacy" element={<PrivacyPage />} /><Route path="/terms" element={<TermsPage />} /><Route path="/admin/login" element={<AdminLoginPage />} /><Route path="/admin" element={<AdminPage />} /><Route path="*" element={<main className="center-state"><h1>Page not found.</h1><Link className="button button-primary" to="/">Return home <ArrowRight size={16} /></Link></main>} /></Routes>{!isAdminRoute && <Footer />}</>
}
