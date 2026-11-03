import { useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useNavigate, useLocation } from 'react-router-dom'
import {
  BookOpen, GraduationCap, LayoutDashboard, LogOut, MessageCircle, Plus,
  Search, ShieldCheck, Sparkles, UserRound, X, FileText, Video, ExternalLink,
  Menu, ArrowRight, LoaderCircle, CheckCircle2, AlertCircle
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import { CLASSES, classLabel } from './lib/classes'

const ADMIN_EMAIL = 'admin@gmail.com'
const ADMIN_PASSWORD = '123456'
const demoMaterials = [
  { id: 'demo-1', class: '8', subject: 'Mathematics', type: 'Notes', content: 'https://ncert.nic.in/', created_at: new Date().toISOString() },
  { id: 'demo-2', class: '8', subject: 'Science', type: 'Lectures', content: 'https://diksha.gov.in/', created_at: new Date().toISOString() },
  { id: 'demo-3', class: '10', subject: 'Mathematics', type: 'Videos', content: 'https://diksha.gov.in/', created_at: new Date().toISOString() }
]

function getAssistantAnswer(value) {
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return ''
    try {
      return getAssistantAnswer(JSON.parse(text)) || text
    } catch {
      return text
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const answer = getAssistantAnswer(item)
      if (answer) return answer
    }
    return ''
  }
  if (value && typeof value === 'object') {
    for (const key of ['output', 'response', 'answer', 'text', 'message', 'content', 'reply', 'data', 'result']) {
      if (key in value) {
        const answer = getAssistantAnswer(value[key])
        if (answer) return answer
      }
    }
  }
  return ''
}

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [booting, setBooting] = useState(true)
  const [notice, setNotice] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!supabase) { setBooting(false); return }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session?.user) await loadProfile(data.session.user)
      setBooting(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)
      if (nextSession?.user) {
        // Defer profile fetch to avoid calling Supabase auth inside its callback.
        setTimeout(() => loadProfile(nextSession.user), 0)
      } else setProfile(null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function loadProfile(user) {
    if (!supabase || !user) return
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    if (!error && data) setProfile(data)
    else if (user.email === ADMIN_EMAIL) setProfile({ id: user.id, role: 'admin', name: 'Teacher Admin', school: 'Campus Learning Hub', class: null })
  }

  function showNotice(message, kind = 'success') {
    setNotice({ message, kind })
    window.setTimeout(() => setNotice(null), 4500)
  }

  async function signOut() {
    if (supabase && session) await supabase.auth.signOut()
    setSession(null); setProfile(null)
    navigate('/login')
  }

  const isAdmin = profile?.role === 'admin' || session?.user?.email === ADMIN_EMAIL
  const authValue = {
    session, profile, setProfile, isAdmin, showNotice, signOut,
    demoMode: !isSupabaseConfigured,
    setSession
  }

  if (booting) return <div className="loading-screen"><LoaderCircle className="spin" size={30}/><span>Preparing your learning space…</span></div>

  return (
    <div className="app-shell">
      {notice && <div className={`toast ${notice.kind}`}><CheckCircle2 size={18}/>{notice.message}<button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={16}/></button></div>}
      <Routes>
        <Route path="/login" element={session && profile ? <Navigate to={isAdmin ? '/teacher' : '/student'} replace/> : <AuthPage {...authValue} mode="login"/>}/>
        <Route path="/teacher-login" element={session && profile ? <Navigate to={isAdmin ? '/teacher' : '/student'} replace/> : <AuthPage {...authValue} mode="login" teacherMode/>}/>
        <Route path="/signup" element={session ? <Navigate to="/student" replace/> : <AuthPage {...authValue} mode="signup"/>}/>
        <Route path="/verified" element={<VerificationPage/>}/>
        <Route path="/teacher/*" element={session && isAdmin ? <TeacherLayout {...authValue}/> : <Navigate to="/login" replace/>}/>
        <Route path="/student/*" element={session && !isAdmin && profile ? <StudentLayout {...authValue}/> : <Navigate to="/login" replace/>}/>
        <Route path="*" element={<Navigate to={session ? (isAdmin ? '/teacher' : '/student') : '/login'} replace/>}/>
      </Routes>
    </div>
  )
}

function Brand({ compact = false }) {
  return <div className="brand"><div className="brand-mark"><GraduationCap size={23}/></div>{!compact && <div><strong>Campus<span>Hub</span></strong><small>LEARN • GROW • ACHIEVE</small></div>}</div>
}

function AuthPage({ mode, showNotice, setProfile, setSession, demoMode, teacherMode = false }) {
  const [tab, setTab] = useState(mode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', email: '', password: '', school: '', class: '1' })
  const navigate = useNavigate()
  const update = e => setForm({ ...form, [e.target.name]: e.target.value })

  async function handleGoogleSignIn() {
    setError('')
    setBusy(true)
    try {
      if (!supabase || demoMode) throw new Error('Google sign-in requires a configured Supabase project.')
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/login` }
      })
      if (signInError) throw signInError
    } catch (err) {
      setError(err.message || 'Google sign-in could not be started. Please try again.')
      setBusy(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setBusy(true)
    try {
      if (teacherMode && form.email.trim().toLowerCase() === ADMIN_EMAIL && form.password === ADMIN_PASSWORD) {
        // This demo-only teacher login does not authenticate against Supabase.
        setSession({ user: { id: 'local-admin', email: ADMIN_EMAIL } })
        setProfile({ id: 'local-admin', role: 'admin', name: 'Teacher Admin', school: 'Campus Learning Hub' })
        showNotice('Welcome back, teacher.')
        navigate('/teacher')
        return
      }
      if (demoMode) throw new Error('Supabase is not configured. Add your project URL and anon key to .env, then restart the app. The admin demo login is available.')
      if (tab === 'signup') {
        if (!form.name.trim() || !form.school.trim()) throw new Error('Please complete all required fields.')
        const { data, error: signError } = await supabase.auth.signUp({
          email: form.email.trim(), password: form.password,
          options: { data: { name: form.name.trim(), school: form.school.trim(), class: form.class } }
        })
        if (signError) throw signError
        if (!data.user) throw new Error('Signup could not be completed.')
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id, role: 'student', name: form.name.trim(),
          school: form.school.trim(), class: form.class
        })
        if (profileError) throw profileError
        // This is a mock confirmation screen; it does not claim an email was actually sent.
        navigate('/verified', { state: { email: form.email.trim(), mock: true } })
      } else {
        const { data, error: loginError } = await supabase.auth.signInWithPassword({
          email: form.email.trim(), password: form.password
        })
        if (loginError) throw loginError
        const { data: p, error: pError } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle()
        if (pError) throw pError
        const isTeacher = p?.role === 'admin' || data.user.app_metadata?.role === 'admin'
        if (teacherMode && !isTeacher) {
          await supabase.auth.signOut()
          throw new Error('This account does not have teacher access.')
        }
        if (!teacherMode && (!p || p.role !== 'student')) throw new Error('Student profile not found. Please sign up or contact your teacher.')
        setProfile(p || { id: data.user.id, role: 'admin', name: data.user.user_metadata?.name || 'Teacher Admin', school: 'Campus Learning Hub' })
        setSession(data.session)
        navigate(teacherMode ? '/teacher' : '/student')
      }
    } catch (err) {
      const message = err.message || ''
      const isEmailRateLimit = err.code === 'over_email_send_rate_limit'
        || /email rate limit exceeded/i.test(message)
        || (tab === 'signup' && err.status === 429)
      setError(isEmailRateLimit
        ? 'Supabase temporarily blocked signup emails because its email limit was reached. Wait before trying again, or disable email confirmation for this demo in Supabase Authentication settings. For production, configure custom SMTP or review your project email limits.'
        : message || 'Something went wrong. Please try again.')
    }
    finally { setBusy(false) }
  }

  return <main className="auth-page">
    <section className="auth-story">
      <Brand/>
      <div className="story-copy">
        <div className="eyebrow"><Sparkles size={15}/> YOUR LEARNING, ORGANIZED</div>
        <h1>Make every day<br/>a <span>step forward.</span></h1>
        <p>A calmer, smarter place to access your study materials, stay curious, and get help when you need it.</p>
        <div className="story-points">
          <div><span className="point-icon"><BookOpen size={18}/></span><div><b>Everything in one place</b><small>Class-wise notes, lectures and videos</small></div></div>
          <div><span className="point-icon"><MessageCircle size={18}/></span><div><b>Ask Campus AI</b><small>Get help with your learning questions</small></div></div>
          <div><span className="point-icon"><ShieldCheck size={18}/></span><div><b>A space built for students</b><small>Simple access to your class materials</small></div></div>
        </div>
      </div>
      <div className="story-footer">© 2026 CampusHub · Learn something new today.</div>
    </section>
    <section className="auth-form-side">
      <div className="mobile-brand"><Brand/></div>
      <div className="auth-card">
        <div className="auth-heading"><div className="mini-label">{teacherMode ? 'TEACHER PORTAL' : tab === 'login' ? 'WELCOME BACK' : 'GET STARTED'}</div><h2>{teacherMode ? 'Teacher sign in' : tab === 'login' ? 'Sign in to your account' : 'Create your student account'}</h2><p>{teacherMode ? 'Sign in to manage classroom resources.' : tab === 'login' ? 'Pick up where you left off.' : 'A few details and your learning space is ready.'}</p></div>
        {!teacherMode && <div className="auth-tabs"><button className={tab === 'login' ? 'active' : ''} onClick={() => {setTab('login');setError('')}}>Sign in</button><button className={tab === 'signup' ? 'active' : ''} onClick={() => {setTab('signup');setError('')}}>Create account</button></div>}
        <form onSubmit={handleSubmit} className="form-stack">
          {tab === 'signup' && <>
            <Field label="Full name"><input name="name" value={form.name} onChange={update} placeholder="e.g. Aanya Sharma" required autoComplete="name"/></Field>
          </>}
          <Field label="Email address"><input type="email" name="email" value={form.email} onChange={update} placeholder="you@school.com" required autoComplete="email"/></Field>
          <Field label="Password"><input type="password" name="password" value={form.password} onChange={update} placeholder="At least 6 characters" minLength={6} required autoComplete={tab === 'login' ? 'current-password' : 'new-password'}/></Field>
          {tab === 'signup' && <>
            <Field label="School name"><input name="school" value={form.school} onChange={update} placeholder="Enter your school name" required/></Field>
            <Field label="Your class"><select name="class" value={form.class} onChange={update}>{CLASSES.map(c => <option key={c.value} value={c.value}>{c.label} Class</option>)}</select></Field>
          </>}
          {error && <div className="inline-error"><AlertCircle size={16}/>{error}</div>}
          <button className="primary-btn full" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18}/> : <>{tab === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={17}/></>}</button>
        </form>
        {tab === 'login' && !teacherMode && <>
          <div className="oauth-divider"><span>OR CONTINUE WITH</span></div>
          <button type="button" className="google-btn" onClick={handleGoogleSignIn} disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={18}/> : <GoogleIcon/>}
            Continue with Google
          </button>
          <button type="button" className="teacher-access-btn" onClick={() => navigate('/teacher-login')}>
            <ShieldCheck size={17}/>
            <span><b>Teacher access</b><small>Sign in to manage study materials</small></span>
            <ArrowRight size={16}/>
          </button>
        </>}
        {teacherMode && <button type="button" className="auth-back-btn" onClick={() => navigate('/login')}>Back to student sign in</button>}
        <p className="auth-legal">By continuing, you agree to use CampusHub respectfully and responsibly.</p>
      </div>
      <div className="auth-bottom">Made for better learning <span>✦</span></div>
    </section>
  </main>
}

function GoogleIcon() {
  return <svg aria-hidden="true" viewBox="0 0 48 48" width="18" height="18">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 6)"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94a11.05 11.05 0 0 1-4.8 7.24l7.73 6c4.51-4.17 7.11-10.3 7.11-17.71Z" transform="translate(0 -3)"/>
    <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.9 23.9 0 0 0 0 21.56l7.98-6.19Z" transform="translate(0 1)"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.14 1.44-4.88 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" transform="translate(0 -6)"/>
  </svg>
}

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

function VerificationPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email
  return <div className="verification-page"><div className="verification-card">
    <div className="success-icon"><CheckCircle2 size={36}/></div><div className="eyebrow">ACCOUNT CREATED</div>
    <h1>You're all set!</h1><p>Your student account has been created{email ? <> for <b>{email}</b></> : ''}. This is a mock confirmation screen for the app demo.</p>
    <div className="mock-note"><ShieldCheck size={18}/><span><b>Demo confirmation</b><small>No verification email was sent. Supabase email confirmation must be disabled in project settings for instant sign-in.</small></span></div>
    <button className="primary-btn full" onClick={() => navigate('/login')}>Continue to sign in <ArrowRight size={17}/></button>
  </div></div>
}

function TeacherLayout(props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const path = useLocation().pathname
  return <DashboardFrame {...props} role="teacher" mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} activePath={path}>
    <Routes><Route index element={<TeacherDashboard {...props}/>}/><Route path="materials" element={<TeacherDashboard {...props}/>}/></Routes>
  </DashboardFrame>
}

function StudentLayout(props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const path = useLocation().pathname
  return <DashboardFrame {...props} role="student" mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} activePath={path}>
    <Routes>
      <Route index element={<StudentDashboard {...props}/>}/>
      <Route path="ai" element={<CampusAI {...props}/>}/>
      <Route path="profile" element={<ProfilePage {...props}/>}/>
    </Routes>
  </DashboardFrame>
}

function DashboardFrame({ role, profile, signOut, children, mobileOpen, setMobileOpen, activePath }) {
  const isTeacher = role === 'teacher'
  const links = isTeacher
    ? [{ to: '/teacher', label: 'Overview', icon: LayoutDashboard }, { to: '/teacher/materials', label: 'Study materials', icon: BookOpen }]
    : [{ to: '/student', label: 'My classroom', icon: LayoutDashboard }, { to: '/student/ai', label: 'Campus AI', icon: Sparkles }, { to: '/student/profile', label: 'My profile', icon: UserRound }]
  return <div className="dashboard-layout">
    <button className="mobile-menu-button" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation"><Menu/></button>
    {mobileOpen && <button className="sidebar-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation"/>}
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand"><Brand/></div>
      <div className="sidebar-section-label">WORKSPACE</div>
      <nav className="sidebar-nav">{links.map(item => <a key={item.to} href={item.to} onClick={() => setMobileOpen(false)} className={`nav-link ${activePath === item.to || (item.to !== '/student' && activePath.startsWith(item.to)) ? 'selected' : ''}`}><item.icon size={18}/><span>{item.label}</span>{item.label === 'Campus AI' && <span className="new-pill">AI</span>}</a>)}</nav>
      <div className="sidebar-spacer"/>
      <div className="sidebar-help"><div className="help-orb"><Sparkles size={17}/></div><b>{isTeacher ? 'Keep learning moving' : 'Curiosity looks good on you.'}</b><p>{isTeacher ? 'Share a resource with your students today.' : 'Ask a question. Explore a new idea.'}</p>{!isTeacher && <a href="/student/ai">Talk to Campus AI <ArrowRight size={14}/></a>}</div>
      <button className="sidebar-user" onClick={signOut}><div className="avatar">{(profile?.name || (isTeacher ? 'Teacher' : 'Student')).slice(0,1).toUpperCase()}</div><div className="user-meta"><b>{profile?.name || (isTeacher ? 'Teacher Admin' : 'Student')}</b><small>{isTeacher ? 'Teacher / Admin' : 'Student account'}</small></div><LogOut size={16}/></button>
    </aside>
    <main className="dashboard-main">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <b>{isTeacher ? 'Teacher portal' : 'Student portal'}</b></div><div className="topbar-right"><span className="online-dot"/> All systems ready <div className="topbar-avatar">{(profile?.name || 'U').slice(0,1).toUpperCase()}</div></div></header>
      <div className="page-content">{children}</div>
    </main>
  </div>
}

function TeacherDashboard({ showNotice, demoMode }) {
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ class: '1', subject: '', type: 'Notes', content: '' })
  const [showForm, setShowForm] = useState(true)

  async function loadMaterials() {
    setLoading(true)
    if (supabase) {
      const { data, error } = await supabase.from('materials').select('*').order('created_at', { ascending: false })
      if (!error) setMaterials(data || [])
      else showNotice(error.message, 'error')
    } else setMaterials(demoMaterials)
    setLoading(false)
  }
  useEffect(() => { loadMaterials() }, [])

  async function addMaterial(e) {
    e.preventDefault(); setSaving(true)
    const item = { class: form.class, subject: form.subject.trim(), type: form.type, content: form.content.trim() }
    if (!item.subject || !item.content) { showNotice('Please complete each material field.', 'error'); setSaving(false); return }
    if (!supabase) {
      setMaterials([{ ...item, id: `local-${Date.now()}`, created_at: new Date().toISOString() }, ...materials])
      showNotice('Added to the local demo list. Configure Supabase to save permanently.')
    } else {
      const { error } = await supabase.from('materials').insert(item)
      if (error) showNotice(error.message, 'error')
      else { showNotice('Study material published successfully.'); await loadMaterials() }
    }
    setForm({ class: '1', subject: '', type: 'Notes', content: '' }); setSaving(false)
  }

  async function deleteMaterial(id) {
    if (!window.confirm('Delete this study material?')) return
    if (supabase && !String(id).startsWith('local-') && !String(id).startsWith('demo-')) {
      const { error } = await supabase.from('materials').delete().eq('id', id)
      if (error) { showNotice(error.message, 'error'); return }
    }
    setMaterials(prev => prev.filter(m => m.id !== id)); showNotice('Material removed.')
  }

  const filtered = materials.filter(m => `${m.subject} ${m.type} ${classLabel(m.class)}`.toLowerCase().includes(search.toLowerCase()))
  return <div className="page-enter">
    <PageHeading eyebrow="TEACHER WORKSPACE" title="Good to see you, Teacher." subtitle="Manage your learning resources and keep every class on track."><div className="heading-actions"><div className="date-chip">{new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div><button className="primary-btn" onClick={() => setShowForm(!showForm)}><Plus size={17}/>{showForm ? 'Hide form' : 'Add material'}</button></div></PageHeading>
    {demoMode && <div className="demo-banner"><AlertCircle size={18}/><span><b>Preview mode</b> — connect Supabase to persist materials and use real student accounts.</span></div>}
    <div className="stats-grid">
      <StatCard icon={BookOpen} label="Total materials" value={materials.length} detail="Across all classes" tint="violet"/>
      <StatCard icon={GraduationCap} label="Class groups" value="10" detail="1st through 10th" tint="blue"/>
      <StatCard icon={Video} label="Resource formats" value="3" detail="Notes, lectures, videos" tint="green"/>
    </div>
    {showForm && <section className="panel add-material-panel">
      <div className="panel-heading"><div className="panel-icon purple"><Plus size={19}/></div><div><h3>Add study material</h3><p>Share a helpful resource with a specific class.</p></div><span className="step-label">NEW RESOURCE</span></div>
      <form className="material-form" onSubmit={addMaterial}>
        <Field label="Class"><select value={form.class} onChange={e => setForm({...form, class:e.target.value})}>{CLASSES.map(c => <option key={c.value} value={c.value}>{c.label} Class</option>)}</select></Field>
        <Field label="Subject"><input value={form.subject} onChange={e => setForm({...form, subject:e.target.value})} placeholder="e.g. Mathematics" required/></Field>
        <Field label="Document type"><select value={form.type} onChange={e => setForm({...form, type:e.target.value})}><option>Lectures</option><option>Notes</option><option>Videos</option></select></Field>
        <Field label="Content or link"><input value={form.content} onChange={e => setForm({...form, content:e.target.value})} placeholder="Paste a URL or add a short description" required/></Field>
        <div className="form-submit-row"><span><ShieldCheck size={15}/> Only the selected class can access this material.</span><button className="primary-btn" disabled={saving}>{saving ? <LoaderCircle className="spin" size={17}/> : <><Plus size={17}/> Publish material</>}</button></div>
      </form>
    </section>}
    <section className="panel materials-panel">
      <div className="panel-heading"><div><h3>Published materials</h3><p>Manage the resources available to your students.</p></div><div className="search-box"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search resources…"/></div></div>
      {loading ? <div className="empty-state"><LoaderCircle className="spin" size={24}/> Loading materials…</div> : filtered.length === 0 ? <div className="empty-state"><BookOpen size={28}/><b>No materials found</b><span>Try another search or publish your first resource.</span></div> :
      <div className="table-wrap"><table className="materials-table"><thead><tr><th>RESOURCE</th><th>CLASS</th><th>TYPE</th><th>ADDED</th><th></th></tr></thead><tbody>{filtered.map(m => <tr key={m.id}><td><div className="resource-cell"><div className={`resource-icon ${m.type.toLowerCase()}`}>{m.type === 'Videos' ? <Video size={17}/> : m.type === 'Lectures' ? <MessageCircle size={17}/> : <FileText size={17}/>}</div><div><b>{m.subject}</b><small className="truncate-text">{m.content}</small></div></div></td><td><span className="class-badge">{classLabel(m.class)}</span></td><td><span className="type-text">{m.type}</span></td><td className="date-text">{m.created_at ? new Date(m.created_at).toLocaleDateString() : '—'}</td><td><button className="icon-btn danger" onClick={() => deleteMaterial(m.id)} title="Delete material"><X size={16}/></button></td></tr>)}</tbody></table></div>}
      <div className="panel-foot"><span>Showing {filtered.length} resource{filtered.length !== 1 ? 's' : ''}</span><span>Class-based access enabled</span></div>
    </section>
  </div>
}

function StudentDashboard({ profile, demoMode }) {
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  useEffect(() => {
    async function load() {
      setLoading(true)
      if (supabase && profile?.class) {
        const { data, error } = await supabase.from('materials').select('*').eq('class', String(profile.class)).order('created_at', { ascending: false })
        setMaterials(error ? [] : (data || []))
      } else setMaterials(demoMaterials.filter(m => String(m.class) === String(profile?.class || '8')))
      setLoading(false)
    }
    load()
  }, [profile?.class])
  const filtered = materials.filter(m => `${m.subject} ${m.type}`.toLowerCase().includes(search.toLowerCase()))
  const firstName = (profile?.name || 'Student').split(' ')[0]
  return <div className="page-enter">
    <PageHeading eyebrow="YOUR LEARNING SPACE" title={`Welcome back, ${firstName}.`} subtitle="Here’s what’s ready for you in your classroom."><div className="profile-chip"><div className="avatar">{firstName.slice(0,1).toUpperCase()}</div><div><b>{profile?.name || 'Student'}</b><small>{profile?.school || 'Your school'}</small></div></div></PageHeading>
    {demoMode && <div className="demo-banner"><AlertCircle size={18}/><span><b>Preview mode</b> — connect Supabase to load your saved class materials.</span></div>}
    <section className="welcome-banner"><div className="welcome-copy"><div className="eyebrow light">YOUR CLASSROOM</div><h2>Small steps make<br/>big discoveries.</h2><p>Explore your materials, build confidence, and keep asking questions.</p><a href="/student/ai">Ask Campus AI <ArrowRight size={16}/></a></div><div className="welcome-art"><div className="art-ring ring-one"/><div className="art-ring ring-two"/><div className="art-book"><BookOpen size={62}/></div><div className="art-spark spark-one">✦</div><div className="art-spark spark-two">✧</div></div><div className="banner-class"><small>YOUR CLASS</small><b>{classLabel(profile?.class || '8')}</b></div></section>
    <div className="section-title-row"><div><h2>Study materials</h2><p>Resources picked for your class.</p></div><div className="search-box"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a resource…"/></div></div>
    {loading ? <div className="empty-state"><LoaderCircle className="spin" size={24}/> Loading your classroom…</div> : filtered.length === 0 ? <div className="panel empty-state"><BookOpen size={30}/><b>No materials yet</b><span>Your teacher hasn’t added resources for this class yet. Check back soon.</span></div> :
    <div className="student-material-grid">{filtered.map(m => <MaterialCard key={m.id} material={m}/>)}</div>}
    <section className="profile-summary panel"><div className="profile-summary-icon"><UserRound size={22}/></div><div className="profile-summary-copy"><b>Your student profile</b><p>{profile?.name} · {profile?.school} · {classLabel(profile?.class)}</p></div><a href="/student/profile">View profile <ArrowRight size={15}/></a></section>
  </div>
}

function MaterialCard({ material }) {
  const isVideo = material.type === 'Videos'
  const isLecture = material.type === 'Lectures'
  const Icon = isVideo ? Video : isLecture ? MessageCircle : FileText
  const url = /^https?:\/\//i.test(material.content)
  return <article className="material-card"><div className={`material-card-icon ${isVideo ? 'mint' : isLecture ? 'blue' : 'lavender'}`}><Icon size={22}/></div><div className="material-card-body"><span className="material-type-label">{material.type}</span><h3>{material.subject}</h3><p>{url ? 'Open the resource to continue learning.' : material.content}</p></div><div className="material-card-footer"><span><GraduationCap size={15}/>{classLabel(material.class)} Class</span>{url ? <a href={material.content} target="_blank" rel="noreferrer" className="open-resource">Open resource <ExternalLink size={14}/></a> : <span className="available-label">Available</span>}</div></article>
}

function CampusAI({ profile, showNotice }) {
  const [messages, setMessages] = useState([{ role: 'assistant', content: `Hi ${((profile?.name || 'there').split(' ')[0])}! 👋 I'm Campus AI. Ask me about a school subject, a concept you're learning, or how to approach a problem.` }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function sendMessage(e) {
    e?.preventDefault()
    const message = input.trim()
    if (!message || sending) return
    setInput('')
    const next = [...messages, { role: 'user', content: message }]
    setMessages(next); setSending(true)
    const webhook = import.meta.env.VITE_N8N_WEBHOOK_URL
    try {
      if (!webhook || webhook.includes('YOUR_N8N_HOST')) throw new Error('Campus AI is not connected yet. Add your n8n webhook URL to .env to enable replies.')
      const response = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          chatInput: message,
          student: { name: profile?.name, school: profile?.school, class: profile?.class },
          history: next.slice(-10)
        })
      })
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('The n8n webhook is not registered. Activate the workflow in n8n and make sure this is its Production URL.')
        }
        throw new Error(`The AI service returned status ${response.status}.`)
      }
      const body = await response.text()
      const answer = getAssistantAnswer(body)
      if (!answer) throw new Error('The AI workflow returned an empty response. Configure the final n8n node to return a text answer (for example, { "output": "..." }).')
      setMessages(prev => [...prev, { role: 'assistant', content: answer }])
    } catch (err) {
      const errorMessage = err instanceof TypeError && /fetch/i.test(err.message)
        ? 'The browser could not reach n8n. In your n8n Webhook node, allow this app origin in Allowed Origins (CORS), then activate the workflow and use its Production URL.'
        : err.message || 'An unexpected error occurred.'
      setMessages(prev => [...prev, { role: 'assistant', content: `I couldn't get an answer. ${errorMessage}` }])
    } finally { setSending(false) }
  }

  return <div className="page-enter ai-page">
    <PageHeading eyebrow="YOUR LEARNING COMPANION" title="Meet Campus AI." subtitle="A little help can make a big difference. Ask away."/>
    <div className="ai-layout">
      <aside className="ai-info panel"><div className="ai-orb"><Sparkles size={27}/></div><h3>Curiosity starts here.</h3><p>Use Campus AI to explore ideas, clarify concepts, and plan your next study session.</p><div className="ai-tips"><b>Try asking</b>{['Explain photosynthesis simply','Help me understand fractions','Give me a study plan for science'].map(t => <button key={t} onClick={() => setInput(t)}><MessageCircle size={15}/>{t}<ArrowRight size={14}/></button>)}</div><div className="ai-safety"><ShieldCheck size={17}/><span>Use AI as a learning guide. Check important answers with your teacher or textbook.</span></div></aside>
      <section className="chat-panel panel"><div className="chat-header"><div className="chat-avatar"><Sparkles size={20}/></div><div><b>Campus AI</b><small><span className="online-dot"/> Learning assistant</small></div><span className="chat-header-pill">BETA</span></div>
        <div className="chat-messages">{messages.map((m,i) => <div key={i} className={`message-row ${m.role}`}><div className={`message-avatar ${m.role}`}>{m.role === 'assistant' ? <Sparkles size={15}/> : (profile?.name || 'S').slice(0,1).toUpperCase()}</div><div className="message-bubble"><span className="message-author">{m.role === 'assistant' ? 'Campus AI' : 'You'}</span><p>{m.content}</p></div></div>)}{sending && <div className="message-row assistant"><div className="message-avatar assistant"><Sparkles size={15}/></div><div className="typing-bubble"><i/><i/><i/></div></div>}<div ref={bottomRef}/></div>
        <form className="chat-compose" onSubmit={sendMessage}><input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask a question about your studies…" aria-label="Message Campus AI"/><button type="submit" disabled={!input.trim() || sending} aria-label="Send message">{sending ? <LoaderCircle className="spin" size={18}/> : <ArrowRight size={19}/>}</button></form><div className="chat-disclaimer">Campus AI can make mistakes. Avoid sharing private information.</div>
      </section>
    </div>
  </div>
}

function ProfilePage({ profile }) {
  return <div className="page-enter"><PageHeading eyebrow="YOUR ACCOUNT" title="Student profile" subtitle="Your school details and classroom information."/><section className="panel profile-detail-panel"><div className="profile-cover"/><div className="profile-detail-avatar">{(profile?.name || 'S').slice(0,1).toUpperCase()}</div><div className="profile-detail-body"><h2>{profile?.name || 'Student'}</h2><span className="student-role-badge">Student account</span><div className="profile-fields"><div><small>FULL NAME</small><b>{profile?.name || '—'}</b></div><div><small>EMAIL ADDRESS</small><b>{profile?.email || 'Signed-in student'}</b></div><div><small>SCHOOL NAME</small><b>{profile?.school || '—'}</b></div><div><small>CLASS</small><b>{classLabel(profile?.class)}</b></div></div></div></section></div>
}

function PageHeading({ eyebrow, title, subtitle, children }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{children}</div>
}
function StatCard({ icon: Icon, label, value, detail, tint }) {
  return <div className="stat-card"><div className={`stat-icon ${tint}`}><Icon size={20}/></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></div>
}

export default App
