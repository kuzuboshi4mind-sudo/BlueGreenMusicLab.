---
title: Contact
permalink: /contact/
---
出演依頼・取材・その他のお問い合わせはこちらからどうぞ。

{% if site.contact_form_url != "" %}<a class="btn" href="{{ site.contact_form_url }}" target="_blank" rel="noopener">お問い合わせフォーム</a>{% endif %}

メール：<a href="mailto:{{ site.contact_email }}">{{ site.contact_email }}</a>

### SNS
{% include sns-links.html %}
