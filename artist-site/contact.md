---
title: Contact
permalink: /contact/
---
お仕事のご依頼（出演・楽曲制作・レコーディング・サポート）、レッスン、CDのご購入、ライブのご予約など、お気軽にご相談ください。

{% if site.web3forms_key != "" %}
<form class="contact-form" action="https://api.web3forms.com/submit" method="POST">
  <input type="hidden" name="access_key" value="{{ site.web3forms_key }}">
  <input type="hidden" name="subject" value="【Webサイト】お問い合わせ">
  <input type="hidden" name="from_name" value="{{ site.title }} Website">
  <input type="checkbox" name="botcheck" class="hp" tabindex="-1" autocomplete="off">
  <label>お名前 *<input name="name" required autocomplete="name"></label>
  <label>メールアドレス *<input type="email" name="email" required autocomplete="email"></label>
  <label>電話番号<input type="tel" name="phone" autocomplete="tel"></label>
  <label>ご用件
    <select name="category">
      <option>お仕事のご依頼</option><option>ライブのご予約</option><option>CDのご購入</option><option>レッスン</option><option>その他</option>
    </select>
  </label>
  <label>メッセージ *<textarea name="message" rows="7" required></textarea></label>
  <button class="btn" type="submit">送信する</button>
  <p class="form-status" role="status"></p>
</form>
{% elsif site.contact_email != "" %}
<p><a class="btn" href="mailto:{{ site.contact_email }}">メールで問い合わせる</a></p>
{% else %}
<p class="muted">お問い合わせフォームは準備中です。各SNSのメッセージからご連絡ください。</p>
{% endif %}

### SNS
{% include sns-links.html %}
