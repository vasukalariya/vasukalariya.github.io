---
layout: default
title: Home
---

# Welcome to My Blog

{% for post in site.posts %}
  <article>
    <h2><a href="{{ post.url }}">{{ post.title }}</a></h2>
    <time>{{ post.date | date: "%B %d, %Y" }}</time>
    {{ post.excerpt }}
  </article>
{% endfor %}