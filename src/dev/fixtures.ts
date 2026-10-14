import { validateSummary, type SummarySegment, type SummaryRequest } from '../shared/summary';
export const fixtureSource = `For years, attention was treated as a matter of personal discipline. People who finished difficult work were assumed to have more willpower than those who struggled. Yet everyday environments quietly shape what we notice and how easily we can stay with one task. A phone left on the desk invites a glance. An unnecessary notification interrupts a train of thought. Meetings placed directly next to each other leave little room to recover or decide what matters next. Even after an interruption ends, returning to the original task can take time. These costs are easy to overlook because each individual interruption seems small. Instead of asking people to resist every distraction, it can help to redesign the defaults around them. Silence alerts that are not needed, leave short gaps between meetings, and put the phone somewhere less convenient to reach. Such adjustments do not require a dramatic lifestyle change. They add a little friction to automatic distractions and create more room for focused work. The aim is not perfect productivity or an empty inbox. It is to make a deliberate choice easier than an automatic one, one ordinary moment at a time.`;
export const fixtureSegments: SummarySegment[] = [
  '**Attention is shaped by our surroundings.** Small changes to daily routines can make focused work easier than constant, automatic distraction.',
  'Notifications pull us between contexts, adding **recovery time** long after the interruption itself has ended.',
  'Rather than relying on willpower, **redesign the defaults**: silence unnecessary alerts, leave gaps between meetings, and keep your phone farther away.',
  'These adjustments do not demand a dramatic lifestyle change. They simply create a little friction around distraction and a little more room for the work that matters.',
  'The goal is not perfect productivity or an empty inbox. It is to make a deliberate choice easier than an automatic one, **one ordinary moment at a time**.',
].map(text => ({ runs: text.split('**').map((text, index) => ({ text, emphasis: index % 2 === 1 })).filter(run => run.text.length > 0) }));
export const shortSource = 'A useful meeting ends with a written decision and a named owner. This gives everyone a clear next step and reduces the need for another meeting.';
export const shortSegments: SummarySegment[] = [{ runs: [
  { text: 'End meetings with ', emphasis: false }, { text: 'a decision and an owner', emphasis: true }, { text: ' to clarify next steps.', emphasis: false },
] }];
export const chineseSource = '城市图书馆不仅提供书籍，也为居民提供安静的学习空间。延长开放时间可以帮助白天工作的读者，但需要同时考虑人员安排和运营成本。';
export const chineseSegments: SummarySegment[] = [{ runs: [
  { text: '延长图书馆开放时间', emphasis: true }, { text: '方便上班族，但需考虑人员与成本。', emphasis: false },
] }];
export function fixtureResult(request: SummaryRequest) {
  const text = request.text.trim().replace(/\s+/g, ' ');
  const segments = text === fixtureSource ? fixtureSegments : text === shortSource ? shortSegments : text === chineseSource ? chineseSegments : null;
  if (!segments) throw new Error('Select one of the fixture passages for the offline test.');
  return validateSummary(request, { segments });
}
