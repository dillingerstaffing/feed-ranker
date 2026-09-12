/* feed-ranker: blog support. Adapts portfolio blog articles to rankable
   items. Article topics are mapped onto the same topic vocabulary the
   wire uses, so one shared profile serves both pages: a read on the wire
   raises affinities the blog ranking also sees, and vice versa. The
   profile storage key is unchanged; nothing about the profile forks. */
(function (ns) {
  'use strict';

  var SOURCE = 'portfolio';
  var KIND = 'post';

  // Ordered rules: first matching topic becomes the primary topic, so
  // put the most specific subjects first. Vocabulary matches the wire;
  // 'algorithm' is added for pure-computation notes the wire never
  // carries (checksums, adders, digit encodings).
  var RULES = [
    { topic: 'kernel',
      re: /\bxv6\b|kernel|syscall|scheduler|\bprocess\b|\bpipe\b|page table|paging|context switch|trap handler|supervisor|interrupt handler|user space/ },
    { topic: 'embedded',
      re: /gpio|\bspi\b|\bi2c\b|\bpwm\b|\badc\b|\bdac\b|esp32|stm32|arduino|microcontroller|dev board|poll loop|memory-mapped/ },
    { topic: 'hardware-hacking',
      re: /solder|\bpcb\b|oscilloscope|multimeter|logic analyzer|decap|\bjtag\b|\bbench\b/ },
    { topic: 'riscv-hardware',
      re: /\bfpga\b|\basic\b|\bsoc\b|development board|tapeout/ },
    { topic: 'tooling',
      re: /\blink(er|ing)?\b|\bgcc\b|toolchain|\bgdb\b|\bqemu\b|makefile|compiler|assembler|objdump|disassembly/ },
    { topic: 'algorithm',
      re: /checksum|one'?s-complement|\bbcd\b|\bcrc\b|\bhash\b|double-dabble|\bdigit\b|djb2/ },
    { topic: 'riscv-isa',
      re: /risc-?v\b|instruction|\bcsrr?[swc]?\b|register|opcode|\bisa\b|privileged|unprivileged|\bhart\b/ }
  ];

  function textOf(article) {
    var parts = [article.title || '', article.description || ''];
    var ps = article.paragraphs || [];
    for (var i = 0; i < ps.length && i < 3; i++) parts.push(ps[i]);
    return parts.join('\n').toLowerCase();
  }

  // Returns 1-3 topics from the shared vocabulary. Falls back to
  // riscv-isa: the blog's subject is RISC-V first, so an unrecognized
  // note is more likely about the ISA than about anything else.
  function topicsFor(article) {
    var text = textOf(article);
    var topics = [];
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i].re.test(text)) topics.push(RULES[i].topic);
      if (topics.length >= 3) break;
    }
    if (!topics.length) topics.push('riscv-isa');
    return topics;
  }

  // Article shape (from data/articles.json): { slug, title, date
  // ("YYYY-MM-DD"), description, paragraphs }. Output is a rankable
  // item: { id, url, title, topics, source, kind, publishedAt, signal }.
  // Articles carry no signal score, so prior starts at 0 and cold start
  // orders by recency, the same as the listing's newest-first default.
  function adapt(article) {
    return {
      id: 'blog:' + article.slug,
      url: '/portfolio/blog/' + article.slug + '/',
      title: article.title,
      topics: topicsFor(article),
      source: SOURCE,
      kind: KIND,
      publishedAt: Date.parse(article.date + 'T00:00:00Z'),
      signal: 0
    };
  }

  function adaptAll(articles) {
    var out = [];
    for (var i = 0; i < articles.length; i++) out.push(adapt(articles[i]));
    return out;
  }

  ns.blog = {
    adapt: adapt,
    adaptAll: adaptAll,
    topicsFor: topicsFor,
    SOURCE: SOURCE,
    KIND: KIND
  };
})(FeedRanker);
