import { useMemo, useState } from 'react'

const ALL_STAGES = ['Potential','Awareness','Research','Pitching','Deployment','Onboarding','Retention']
const ALL_STAKEHOLDERS = ['User(s)','Champion','Exec / Approver','Team Lead (Systems/QA)','QA','Peers/Refs']

const data = [
  { stage:'Potential', stakeholder:'User(s)',
    motivation:'Frustrated with manual proofreading; accuracy and workload issues',
    goal:'Spark awareness that automation exists and can help',
    support:'Awareness content: articles, SEO, thought leadership',
    plays:['Marketing: Highlight stress/workload and risk of errors','Sales: Intro call script that frames problem and outcomes','CS/Product: Share examples of avoided mistakes via automation'],
    touchpoints:['Articles','SEO','Social','Thought Leadership','Ads'],
    kpi:'CTR on content, reach/impressions'
  },
  { stage:'Potential', stakeholder:'Champion',
    motivation:'Overloaded; wants efficiency for team',
    goal:'Recognize the problem is worth solving; curiosity to explore',
    support:'Problem-framing assets: blogs, webinars, consequence-focused messaging',
    plays:["Sales: Ask 'How are you coping with workload today?'",'Marketing: Emphasize stress/pain in campaigns'],
    touchpoints:['Blogs','Webinars','LinkedIn','Ads'],
    kpi:'Leads generated, webinar sign-ups'
  },
  { stage:'Potential', stakeholder:'Exec / Approver',
    motivation:'Wants productivity gains; avoid costly mistakes',
    goal:'Interest in exploring efficiency technology',
    support:'High-level overview decks, ROI framing',
    plays:['Sales: Position automation as cost-saving and risk-reducing','Marketing: Distribute efficiency and accuracy examples'],
    touchpoints:['Overview Deck','Email Outreach','Exec Brief','Website'],
    kpi:'Overview downloads, exec meetings booked'
  },
  { stage:'Awareness', stakeholder:'User(s)',
    motivation:"Not aware of the category ('Wait—there’s software for this?')",
    goal:'Users aware TVT exists',
    support:'Ads, SEO, explainer videos',
    plays:['Marketing: Educational campaigns clarifying the category','Sales: Light outreach with explainer deck'],
    touchpoints:['SEO','SEM','Ads','Explainer Videos','Website'],
    kpi:'Traffic to product page, new leads'
  },
  { stage:'Awareness', stakeholder:'Champion',
    motivation:'Knows problem; wants to know options',
    goal:'Champion aware of TVT as credible vendor',
    support:'Thought leadership and case studies',
    plays:["Sales: Ask 'What are you currently using?'",'Marketing: Retarget with testimonials'],
    touchpoints:['LinkedIn','Case Studies','Ads','Events'],
    kpi:'Case study downloads; champion-labeled leads'
  },
  { stage:'Research', stakeholder:'User(s)',
    motivation:'Seeking best-fit; manual proofing is slow and painful',
    goal:'Discover TVT as viable solution',
    support:'Website flow, product videos, FAQs, case studies',
    plays:['Marketing: Ensure discoverability (SEO, SEM, reviews)','Sales: Offer demos; answer feature questions'],
    touchpoints:['Website','Product Videos','FAQs','Case Studies','SEO','SEM','Reviews'],
    kpi:'Engagement (CTR, time on page), demo requests'
  },
  { stage:'Research', stakeholder:'Champion',
    motivation:'Must validate options, build internal case; not yet confident; fears change',
    goal:'Champion buys in and advocates internally',
    support:'Demos, competitive comparisons, ROI templates, reference stories',
    plays:["Sales: Ask 'What would make this credible for your boss?' and tailor demo",'Marketing: Send industry-similar case study','CS: Offer intro to satisfied peer user'],
    touchpoints:['Demos','Competitive Decks','ROI Templates','Peer References','Webinars'],
    kpi:'Demo→proposal conversion; # of champions activated'
  },
  { stage:'Research', stakeholder:'Exec / Approver',
    motivation:'Focused on cost, compliance, risk; prefers proven tech and low maintenance',
    goal:'Approve shortlist / budget for pilot',
    support:'Business case template; efficiency & risk reduction proof',
    plays:['Sales: Deliver clear cost/licensing models','Marketing: Position as category leader in content comparison'],
    touchpoints:['Business Case','Security/Compliance Docs','Exec Brief','Website'],
    kpi:'Budget approval rate; positive ROI assessment'
  },
  { stage:'Research', stakeholder:'Team Lead (Systems/QA)',
    motivation:'Needs assurance on integration, validation, scaling',
    goal:'Confidence TVT fits workflow & compliance',
    support:'Tech specs, validation plan, supplier audit info',
    plays:['Product/Support: Provide docs and validation checklist','Sales: Address validation concerns early'],
    touchpoints:['Tech Specs','Validation Plan','Supplier Audit','IT FAQ'],
    kpi:'# validations passed; IT sign-off'
  },
  { stage:'Research', stakeholder:'Peers/Refs',
    motivation:'Wants to know what others use; credibility via peers',
    goal:'Peer validation confirms TVT',
    support:'Customer references, thought leadership, external reviews',
    plays:['Marketing: Amplify presence on G2/Capterra','Sales/CS: Activate happy users for referrals'],
    touchpoints:['G2/Capterra','Peer Calls','LinkedIn','Case Studies'],
    kpi:'Referrals; review count and ratings'
  },
  { stage:'Pitching', stakeholder:'Champion',
    motivation:'Needs internal approval; hopes solution gets approved',
    goal:'Champion successfully presents internal case',
    support:'Business case templates, ROI content, competitive decks',
    plays:['Sales: Coach champion; run dry-run of the pitch','CS: Provide proof of success and references'],
    touchpoints:['Internal Pitch Deck','ROI Calculator','Email','Meeting'],
    kpi:'Approval to proceed; business case adoption'
  },
  { stage:'Pitching', stakeholder:'Exec / Approver',
    motivation:'Needs cost clarity and compliance reassurance',
    goal:'Decision to purchase TVT',
    support:'Clear pricing, contract, compliance checklists',
    plays:['Sales: Present ROI and compliance fit with examples'],
    touchpoints:['Pricing Sheet','Contract Review','Security/Compliance Docs','Meeting'],
    kpi:'Signed contract; reduced procurement delays'
  },
  { stage:'Pitching', stakeholder:'Team Lead (Systems/QA)',
    motivation:'Needs confidence there’s no workflow disruption',
    goal:'Sign-off on deployment',
    support:'Implementation guides, FAQs',
    plays:['Support: Join technical Q&A','Sales: Walk through implementation steps'],
    touchpoints:['Implementation Guide','IT FAQ','Q&A Session','Email'],
    kpi:'Deployment readiness; no blockers'
  },
  { stage:'Deployment', stakeholder:'Team Lead (Systems/QA)',
    motivation:'Wants smooth implementation and minimal downtime',
    goal:'Successful installation and go-live',
    support:'Kick-off checklist; installation instructions',
    plays:['Support: Ensure fast setup; align timelines','Sales: Coordinate with IT and procurement'],
    touchpoints:['Kick-off','Install Instructions','Support Tickets','Internal Comms'],
    kpi:'On-time go-live; minimal downtime'
  },
  { stage:'Deployment', stakeholder:'User(s)',
    motivation:'Worried about effort and learning curve',
    goal:'System accessible and ready for use',
    support:'Welcome/onboarding package; training overview',
    plays:['CS: Guide early usage and logins','Support: Proactively check access issues'],
    touchpoints:['Welcome Package','Training Overview','Access Emails','KB'],
    kpi:'Access confirmed; early adoption'
  },
  { stage:'Deployment', stakeholder:'QA',
    motivation:'Compliance, validation, documentation focus',
    goal:'Validation requirements met',
    support:'Validation docs; SOP templates',
    plays:['Support/Product: Provide compliance-ready materials'],
    touchpoints:['Validation Docs','SOP Templates','GxP Training Record'],
    kpi:'Validation passed; compliance approval'
  },
  { stage:'Onboarding', stakeholder:'User(s)',
    motivation:'Post-purchase anxiety; training perceived as long',
    goal:'Users adopt TVT confidently',
    support:'Training, e-learning, super-user program',
    plays:['CS: Schedule welcome session and quick wins','Support: Tip-of-the-day comms'],
    touchpoints:['Welcome Session','E-learning','KB','Dashboard'],
    kpi:'Training completion; active usage'
  },
  { stage:'Onboarding', stakeholder:'Team Lead (Systems/QA)',
    motivation:'Needs team adoption and smooth transition',
    goal:'Team uses TVT regularly',
    support:'Onboarding template; clear internal comms',
    plays:['CS: Run kickoff; ensure right people involved','Marketing: Provide guides and one-pagers'],
    touchpoints:['Kick-off','Internal Comms','Onboarding Template','Training Plan'],
    kpi:'Adoption rate; # trained users'
  },
  { stage:'Onboarding', stakeholder:'QA',
    motivation:'Assure compliance criteria are met',
    goal:'QA confident in compliance use',
    support:'Training records; certificates',
    plays:['Support: Compliance-focused training and documentation'],
    touchpoints:['Training Record','Certificate','KB'],
    kpi:'QA sign-off; compliance adherence'
  },
  { stage:'Retention', stakeholder:'User(s)',
    motivation:"'Are we still getting value?'",
    goal:'Users engaged, confident, satisfied',
    support:'Regular check-ins; support; dashboard analytics',
    plays:['CS: Review usage stats; suggest feature tips','Sales: Identify upsell based on usage gaps'],
    touchpoints:['Check-ins','Support Cases','Dashboard Analytics','Mailings'],
    kpi:'High NPS; engagement stats'
  },
  { stage:'Retention', stakeholder:'Champion',
    motivation:'Needs to show continued ROI internally',
    goal:'Champion advocates renewal/expansion',
    support:'Business reviews; ROI reports',
    plays:['Sales: Schedule ROI/business review','CS: Supply usage analytics and wins'],
    touchpoints:['Business Review','ROI Report','Email','Meeting'],
    kpi:'Renewal rate; expansion opportunities'
  },
  { stage:'Retention', stakeholder:'Exec / Approver',
    motivation:'Budget-limited; needs proof of value',
    goal:'Exec approves renewal',
    support:'Clear contracts; analytics; case studies',
    plays:['Sales: Provide renewal justification and impact','Support: Demonstrate minimized time-to-value'],
    touchpoints:['Renewal Proposal','Contract','Dashboard','Case Studies'],
    kpi:'Renewal signed; upsell conversations'
  },
  { stage:'Retention', stakeholder:'QA',
    motivation:'Ongoing compliance; updates',
    goal:'Confidence TVT continues to meet needs',
    support:'Knowledge base; refreshers; updated training',
    plays:['Support: Fast case handling; share update notes','CS: Encourage refreshers/e-learning'],
    touchpoints:['KB','Release Notes','Refresher Training','Support'],
    kpi:'Low churn; high compliance confidence'
  }
]

function ToggleRail({ label, values, selected, onToggle, onSelectAll, onClear }){
  return (
    <div>
      <div className="section-title">{label}</div>
      <div className="rail">
        {values.map(v => (
          <button
            key={v}
            className={`btn ${selected.includes(v) ? 'active' : ''}`}
            aria-pressed={selected.includes(v)}
            onClick={() => onToggle(v)}
          >{v}</button>
        ))}
        <button className="btn ghost" onClick={onSelectAll}>All</button>
        <button className="btn ghost" onClick={onClear}>Clear</button>
      </div>
    </div>
  )
}

export default function App(){
  const [selectedStages, setSelectedStages] = useState([...ALL_STAGES])
  const [selectedStakeholders, setSelectedStakeholders] = useState([...ALL_STAKEHOLDERS])
  const [condensed, setCondensed] = useState(true); // default to Condensed
  const toggle = (setArr) => (val) => {
    setArr(curr => curr.includes(val) ? curr.filter(x => x !== val) : [...curr, val])
  }

  const visible = useMemo(() => {
    return data.filter(d => selectedStages.includes(d.stage) && selectedStakeholders.includes(d.stakeholder))
  }, [selectedStages, selectedStakeholders])

  const gridStyle = {
    gridTemplateColumns: `200px ${selectedStakeholders.map(()=> 'minmax(280px, 1fr)').join(' ')}`
  }

  // map by stage + stakeholder for grid lookup
  const byStage = useMemo(() => {
    const m = new Map()
    for (const st of selectedStages) m.set(st, {})
    for (const row of visible) {
      if (!m.has(row.stage)) m.set(row.stage, {})
      m.get(row.stage)[row.stakeholder] = row
    }
    return m
  }, [visible, selectedStages])

  return (
    <div className="container">
      <h1 className="h1">Customer Journey Grid</h1>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8, gap:8 }}>
      <button
    className={`btn ${condensed ? 'active' : ''}`}
    aria-pressed={condensed}
    onClick={()=>setCondensed(true)}
    title="Compact cards (show only KPI + quick peek)"
      >Condensed</button>
    <button
    className={`btn ${!condensed ? 'active' : ''}`}
    aria-pressed={!condensed}
    onClick={()=>setCondensed(false)}
    title="Full cards (open all details)"
    >Expanded</button>
</div>
      <div className="controls">
        <ToggleRail
          label="Journey Stages"
          values={ALL_STAGES}
          selected={selectedStages}
          onToggle={toggle(setSelectedStages)}
          onSelectAll={() => setSelectedStages([...ALL_STAGES])}
          onClear={() => setSelectedStages([])}
        />
        <ToggleRail
          label="Stakeholders"
          values={ALL_STAKEHOLDERS}
          selected={selectedStakeholders}
          onToggle={toggle(setSelectedStakeholders)}
          onSelectAll={() => setSelectedStakeholders([...ALL_STAKEHOLDERS])}
          onClear={() => setSelectedStakeholders([])}
        />
      </div>

      <div className="grid-wrap">
        <div className="grid" style={gridStyle}>
          {selectedStages.map(stage => {
            const rowMap = byStage.get(stage) || {}
            return (
              <div key={stage} className="row">
                {selectedStakeholders.map(sh => {
                  const row = rowMap[sh]
                  if (!row) return <div key={sh} className="card-cell"><div className="empty">—</div></div>
                  return (
                    <div key={sh} className="card-cell">
                      <div className="card">
                        <h3>{row.stakeholder} @ {row.stage}</h3>
                        <div className="kpi">KPI: {row.kpi}</div>
                        {/* Condensed: keep details collapsed (peek), Expanded: open fully */}
                          <details open={!condensed} className={condensed ? '' : 'opened'}>
                          <summary className="summary-line">Details</summary>
                            
                          <p className="meta"><strong>Motivation:</strong> {row.motivation}</p>
                          <p className="meta"><strong>Goal:</strong> {row.goal}</p>
                          <p className="meta"><strong>Support:</strong> {row.support}</p>
                          <div className="meta"><strong>Plays:</strong><ul className="list">{row.plays.map((p,i)=><li key={i}>{p}</li>)}</ul></div>
                          <div className="chips" style={{marginTop:6}}>
                            {row.touchpoints.map((t,i)=>(<span key={i} className="chip">{t}</span>))}
                          </div>
                        </details>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
