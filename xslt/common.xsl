<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:lb="https://lenz-archiv.de"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:t="urn:lenz-temp"
  exclude-result-prefixes="lb xs t">

  <xsl:output method="html" encoding="UTF-8" omit-xml-declaration="yes" indent="no" />
  <xsl:mode on-no-match="shallow-skip" />
  <xsl:mode name="lb:classify-pages" on-no-match="shallow-copy" />

  <xsl:template name="lb:render-flow">
    <xsl:param name="nodes" as="node()*" />
    <xsl:param name="page-id-prefix" as="xs:string" select="'page-'" />
    <!-- Classify milestones on the complete semantic lines, before alignment
         distributes their content into separate regions. -->
    <xsl:variable name="flow" as="element(t:flow)">
      <t:flow><xsl:sequence select="lb:normalize-lines($nodes)" /></t:flow>
    </xsl:variable>
    <xsl:variable name="classified" as="element(t:flow)">
      <xsl:apply-templates select="$flow" mode="lb:classify-pages" />
    </xsl:variable>
    <xsl:apply-templates select="$classified/node()">
      <xsl:with-param name="page-id-prefix" select="$page-id-prefix" tunnel="yes" />
    </xsl:apply-templates>
  </xsl:template>

  <xsl:function name="lb:has-meaningful-content" as="xs:boolean">
    <xsl:param name="nodes" as="node()*" />
    <xsl:sequence select="
      exists(
        $nodes[
          self::text()[normalize-space()]
          or self::*[not(self::t:page)]
        ]
      )
    " />
  </xsl:function>

  <xsl:function name="lb:temp-line" as="element(t:line)">
    <xsl:param name="nodes" as="node()*" />
    <t:line>
      <xsl:sequence select="$nodes" />
    </t:line>
  </xsl:function>

  <xsl:function name="lb:temp-explicit-line" as="element(t:line)">
    <xsl:param name="type" as="xs:string?" />
    <xsl:param name="tab" as="xs:string?" />
    <xsl:param name="nodes" as="node()*" />
    <t:line>
      <xsl:if test="exists($type)">
        <xsl:attribute name="type" select="$type" />
      </xsl:if>
      <xsl:if test="exists($tab)">
        <xsl:attribute name="tab" select="$tab" />
      </xsl:if>
      <xsl:sequence select="$nodes" />
    </t:line>
  </xsl:function>

  <xsl:function name="lb:temp-page" as="element(t:page)">
    <xsl:param name="index" as="xs:string" />
    <t:page index="{$index}" />
  </xsl:function>

  <xsl:function name="lb:clone-element" as="element()">
    <xsl:param name="element" as="element()" />
    <xsl:param name="children" as="node()*" />
    <xsl:element name="{local-name($element)}" namespace="{namespace-uri($element)}">
      <xsl:copy-of select="$element/@*" />
      <xsl:sequence select="$children" />
    </xsl:element>
  </xsl:function>

  <xsl:function name="lb:alignment-slot" as="xs:string">
    <xsl:param name="pos" as="xs:string?" />
    <xsl:sequence select="
      if ($pos = 'center')
      then 'center'
      else if ($pos = 'right')
      then 'right'
      else 'left'
    " />
  </xsl:function>

  <xsl:function name="lb:slots-for-node" as="xs:string*">
    <xsl:param name="node" as="node()" />
    <xsl:sequence select="
      if ($node/self::lb:align)
      then lb:alignment-slot(string($node/@pos))
      else if ($node/self::text()[normalize-space()])
      then 'left'
      else if ($node/self::text())
      then ()
      else if ($node/self::t:page)
      then (let $next := $node/following-sibling::node()[not(self::t:page or self::text()[not(normalize-space())])][1],
                $previous := $node/preceding-sibling::node()[not(self::t:page or self::text()[not(normalize-space())])][1]
            return (if ($next) then lb:node-slot($next) else if ($previous) then lb:node-slot($previous) else (), 'left')[1])
      else if ($node/self::t:tabs or $node/self::lb:tab)
      then 'left'
      else if ($node/self::element())
      then (let $slots := distinct-values(for $child in $node/node() return lb:slots-for-node($child))
            return if (exists($slots)) then $slots else 'left')
      else ()
    " />
  </xsl:function>

  <xsl:function name="lb:node-slot" as="xs:string?">
    <xsl:param name="node" as="node()" />
    <xsl:choose>
      <xsl:when test="$node/self::text()[not(normalize-space())]">
        <xsl:variable
          name="preceding-meaningful"
          as="node()?"
          select="$node/preceding-sibling::node()[not(self::text()[not(normalize-space())])][1]"
        />
        <xsl:variable
          name="following-meaningful"
          as="node()?"
          select="$node/following-sibling::node()[not(self::text()[not(normalize-space())])][1]"
        />
        <xsl:variable
          name="preceding-slot"
          as="xs:string?"
          select="if (exists($preceding-meaningful)) then lb:node-slot($preceding-meaningful) else ()"
        />
        <xsl:variable
          name="following-slot"
          as="xs:string?"
          select="if (exists($following-meaningful)) then lb:node-slot($following-meaningful) else ()"
        />
        <xsl:sequence select="
          if ($preceding-slot = $following-slot and exists($preceding-slot))
          then $preceding-slot
          else ()
        " />
      </xsl:when>
      <xsl:otherwise>
        <xsl:variable name="slots" as="xs:string*" select="lb:slots-for-node($node)" />
        <xsl:sequence select="
          if (count($slots) = 1)
          then $slots[1]
          else if (empty($slots))
          then ()
          else 'left'
        " />
      </xsl:otherwise>
    </xsl:choose>
  </xsl:function>

  <xsl:function name="lb:filter-slot-nodes" as="node()*">
    <xsl:param name="nodes" as="node()*" />
    <xsl:param name="slot" as="xs:string" />
    <xsl:param name="inherited-slot" as="xs:string?" />
    <xsl:for-each select="$nodes">
      <xsl:choose>
        <xsl:when test="self::text()">
          <xsl:variable
            name="resolved-slot"
            as="xs:string?"
            select="if (exists($inherited-slot)) then $inherited-slot else lb:node-slot(.)"
          />
          <xsl:if test="exists($resolved-slot) and $resolved-slot = $slot">
            <xsl:sequence select="." />
          </xsl:if>
        </xsl:when>
        <!-- A table/cell owns its alignment context. Do not distribute its
             descendants into the surrounding line's regions. -->
        <xsl:when test="self::t:tabs or self::lb:tab">
          <xsl:if test="(if ($inherited-slot) then $inherited-slot else 'left') = $slot">
            <xsl:sequence select="." />
          </xsl:if>
        </xsl:when>
        <xsl:when test="self::lb:align">
          <xsl:if test="lb:alignment-slot(string(@pos)) = $slot">
            <xsl:sequence select="lb:filter-slot-nodes(node(), $slot, $slot)" />
          </xsl:if>
        </xsl:when>
        <xsl:when test="self::comment() or self::processing-instruction()">
          <xsl:sequence />
        </xsl:when>
        <xsl:otherwise>
          <xsl:variable name="node-slot" as="xs:string?" select="lb:node-slot(.)" />
          <xsl:variable
            name="child-slot"
            as="xs:string?"
            select="
              if (exists($inherited-slot))
              then $inherited-slot
              else if (exists($node-slot) and $node-slot != 'left')
              then $node-slot
              else ()
            "
          />
          <xsl:variable
            name="children"
            as="node()*"
            select="lb:filter-slot-nodes(node(), $slot, $child-slot)"
          />
          <xsl:choose>
            <xsl:when test="exists($children)">
              <xsl:sequence select="lb:clone-element(., $children)" />
            </xsl:when>
            <xsl:when test="exists(if (exists($inherited-slot)) then $inherited-slot else $node-slot) and (if (exists($inherited-slot)) then $inherited-slot else $node-slot) = $slot">
              <xsl:sequence select="lb:clone-element(., ())" />
            </xsl:when>
          </xsl:choose>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:for-each>
  </xsl:function>

  <xsl:function name="lb:flush-state" as="map(*)">
    <xsl:param name="completed" as="element()*" />
    <xsl:param name="current-type" as="xs:string?" />
    <xsl:param name="current-tab" as="xs:string?" />
    <xsl:param name="current-content" as="node()*" />
    <xsl:variable
      name="trailing-content-start"
      as="xs:integer?"
      select="
        (
          for $index in reverse(1 to count($current-content))
          return
            if (
              $current-content[$index]/self::t:page
              or $current-content[$index]/self::text()[not(normalize-space())]
            )
            then ()
            else $index + 1
        )[1]
      "
    />
    <!-- Only move a trailing milestone across a boundary. Whitespace at the
         end of a formatting wrapper may separate words and must survive. -->
    <xsl:variable name="trailing-marker-start" as="xs:integer?" select="
      if (exists($current-content[position() ge $trailing-content-start][self::t:page]))
      then $trailing-content-start else ()" />
    <xsl:variable
      name="leading-content"
      as="node()*"
      select="
        if (exists($trailing-marker-start))
        then $current-content[position() lt $trailing-marker-start]
        else ()
      "
    />
    <xsl:variable
      name="trailing-markers"
      as="node()*"
      select="
        if (exists($trailing-marker-start))
        then $current-content[position() ge $trailing-marker-start]
        else ()
      "
    />
    <xsl:variable name="next-completed" as="element()*" select="
      if (lb:has-meaningful-content($current-content) or exists($current-type) or exists($current-tab))
      then (
        $completed,
        if (exists($current-type) or exists($current-tab))
        then lb:temp-explicit-line(
          $current-type,
          $current-tab,
          if (exists($trailing-marker-start)) then $leading-content else $current-content
        )
        else lb:temp-line(if (exists($trailing-marker-start)) then $leading-content else $current-content)
      )
      else $completed
    " />
    <xsl:sequence select="map {
      'completed': $next-completed,
      'currentType': (),
      'currentTab': (),
      'currentContent': if (lb:has-meaningful-content($current-content) or exists($current-type) or exists($current-tab)) then $trailing-markers else $current-content
    }" />
  </xsl:function>

  <xsl:function name="lb:merge-lines-into-state" as="map(*)">
    <xsl:param name="completed" as="element()*" />
    <xsl:param name="current-type" as="xs:string?" />
    <xsl:param name="current-tab" as="xs:string?" />
    <xsl:param name="current-content" as="node()*" />
    <xsl:param name="incoming-lines" as="element(t:line)*" />
    <xsl:iterate select="$incoming-lines">
      <xsl:param name="completed" as="element()*" select="$completed" />
      <xsl:param name="current-type" as="xs:string?" select="$current-type" />
      <xsl:param name="current-tab" as="xs:string?" select="$current-tab" />
      <xsl:param name="current-content" as="node()*" select="$current-content" />
      <xsl:on-completion select="map {
        'completed': $completed,
        'currentType': $current-type,
        'currentTab': $current-tab,
        'currentContent': $current-content
      }" />
      <xsl:variable name="line-type" as="xs:string?" select="if (@type) then string(@type) else ()" />
      <xsl:variable name="line-tab" as="xs:string?" select="if (@tab) then string(@tab) else ()" />
      <xsl:choose>
        <xsl:when test="empty(@type) and empty(@tab)">
          <xsl:next-iteration>
            <xsl:with-param name="completed" select="$completed" />
            <xsl:with-param name="current-type" select="$current-type" />
            <xsl:with-param name="current-tab" select="$current-tab" />
            <xsl:with-param name="current-content" select="($current-content, node())" />
          </xsl:next-iteration>
        </xsl:when>
        <xsl:when test="$line-type = ('line', 'vspace')">
          <xsl:variable name="flushed" select="lb:flush-state($completed, $current-type, $current-tab, $current-content)" />
          <xsl:next-iteration>
            <xsl:with-param name="completed" select="($flushed?completed, lb:temp-explicit-line($line-type, $line-tab, ($flushed?currentContent, node())))" />
            <xsl:with-param name="current-type" select="()" />
            <xsl:with-param name="current-tab" select="()" />
            <xsl:with-param name="current-content" select="()" />
          </xsl:next-iteration>
        </xsl:when>
        <xsl:otherwise>
          <xsl:variable name="flushed" select="lb:flush-state($completed, $current-type, $current-tab, $current-content)" />
          <xsl:next-iteration>
            <xsl:with-param name="completed" select="$flushed?completed" />
            <xsl:with-param name="current-type" select="$line-type" />
            <xsl:with-param name="current-tab" select="$line-tab" />
            <xsl:with-param name="current-content" select="($flushed?currentContent, node())" />
          </xsl:next-iteration>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:iterate>
  </xsl:function>

  <!-- A phrasing wrapper cannot contain a generated table div. Split it
       around flow containers and carry the formatting into their cells. -->
  <xsl:function name="lb:wrap-content" as="element()*">
    <xsl:param name="wrapper" as="element()" />
    <xsl:param name="nodes" as="node()*" />
    <xsl:choose>
      <xsl:when test="$wrapper/self::lb:tab or empty($nodes)">
        <xsl:sequence select="lb:clone-element($wrapper, $nodes)" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:for-each-group select="$nodes"
          group-adjacent="self::t:tabs or self::t:row or self::lb:tab or self::lb:vspace">
          <xsl:choose>
            <xsl:when test="current-grouping-key()">
              <xsl:for-each select="current-group()">
                <xsl:sequence select="if (self::lb:vspace) then .
                  else lb:clone-element(., lb:wrap-content($wrapper, node()))" />
              </xsl:for-each>
            </xsl:when>
            <xsl:otherwise>
              <xsl:sequence select="lb:clone-element($wrapper, current-group())" />
            </xsl:otherwise>
          </xsl:choose>
        </xsl:for-each-group>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:function>

  <xsl:function name="lb:wrap-element-across-lines" as="element(t:line)*">
    <xsl:param name="element" as="element()" />
    <xsl:param name="lines" as="element(t:line)*" />
    <xsl:choose>
      <xsl:when test="empty($lines)">
        <xsl:sequence select="lb:temp-line(lb:clone-element($element, ()))" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:sequence select="
          for $line in $lines
          return
            if ($line/@type = 'vspace') then $line
            else if ($line/@type = 'line' and not(lb:has-meaningful-content($line/node())))
            then lb:temp-explicit-line(string($line/@type), if ($line/@tab) then string($line/@tab) else (), $line/node())
            else if (exists($line/@type) or exists($line/@tab))
            then lb:temp-explicit-line(
              if ($line/@type) then string($line/@type) else (),
              if ($line/@tab) then string($line/@tab) else (),
              lb:wrap-content($element, $line/node())
            )
            else lb:temp-line(lb:wrap-content($element, $line/node()))
        " />
      </xsl:otherwise>
    </xsl:choose>
  </xsl:function>

  <xsl:function name="lb:normalize-tabs" as="element(t:tabs)">
    <xsl:param name="element" as="element(lb:tabs)" />
    <t:tabs>
      <xsl:if test="$element/@extent">
        <xsl:attribute name="extent" select="string($element/@extent)" />
      </xsl:if>
      <xsl:for-each select="lb:normalize-lines($element/node())">
        <t:row>
          <xsl:if test="@type">
            <xsl:attribute name="type" select="string(@type)" />
          </xsl:if>
          <xsl:if test="@tab">
            <xsl:attribute name="tab" select="string(@tab)" />
          </xsl:if>
          <xsl:sequence select="node()" />
        </t:row>
      </xsl:for-each>
    </t:tabs>
  </xsl:function>

  <xsl:function name="lb:normalize-node-to-lines" as="element(t:line)*">
    <xsl:param name="node" as="node()" />
    <xsl:choose>
      <xsl:when test="$node/self::text()">
        <xsl:sequence select="lb:temp-line($node)" />
      </xsl:when>
      <xsl:when test="$node/self::element(lb:vspace)">
        <xsl:sequence select="lb:temp-explicit-line('vspace', (), $node)" />
      </xsl:when>
      <xsl:when test="$node/self::element(lb:page)">
        <xsl:sequence select="lb:temp-line(lb:temp-page(string($node/@index)))" />
      </xsl:when>
      <xsl:when test="$node/self::element(lb:sidenote) or $node/self::comment() or $node/self::processing-instruction()">
        <xsl:sequence select="()" />
      </xsl:when>
      <xsl:when test="$node/self::element(lb:address)">
        <xsl:sequence select="lb:normalize-lines($node/node())" />
      </xsl:when>
      <xsl:when test="$node/self::element(lb:tabs)">
        <xsl:sequence select="lb:temp-line(lb:normalize-tabs($node))" />
      </xsl:when>
      <xsl:when test="$node/self::element()">
        <xsl:sequence select="lb:wrap-element-across-lines($node, lb:normalize-lines($node/node()))" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:sequence select="lb:temp-line($node)" />
      </xsl:otherwise>
    </xsl:choose>
  </xsl:function>

  <xsl:function name="lb:normalize-lines" as="element(t:line)*">
    <xsl:param name="nodes" as="node()*" />
    <xsl:variable name="state" as="map(*)">
      <xsl:iterate select="$nodes">
        <xsl:param name="completed" as="element(t:line)*" select="()" />
        <xsl:param name="current-type" as="xs:string?" select="()" />
        <xsl:param name="current-tab" as="xs:string?" select="()" />
        <xsl:param name="current-content" as="node()*" select="()" />
        <xsl:on-completion>
          <xsl:variable name="flushed" select="lb:flush-state($completed, $current-type, $current-tab, $current-content)" />
          <xsl:sequence select="map {
            'completed': ($flushed?completed,
              if (exists($flushed?currentContent))
              then lb:temp-line($flushed?currentContent) else ())
          }" />
        </xsl:on-completion>
        <xsl:choose>
          <xsl:when test="self::element(lb:line)">
            <xsl:variable name="line-type" as="xs:string" select="if (@type) then string(@type) else 'break'" />
            <xsl:variable name="line-tab" as="xs:string?" select="if (@tab) then string(@tab) else ()" />
            <xsl:variable name="flushed" select="lb:flush-state($completed, $current-type, $current-tab, $current-content)" />
            <xsl:choose>
              <xsl:when test="$line-type = ('line', 'vspace')">
                <xsl:next-iteration>
                  <xsl:with-param name="completed" select="($flushed?completed, lb:temp-explicit-line($line-type, $line-tab, $flushed?currentContent))" />
                  <xsl:with-param name="current-type" select="()" />
                  <xsl:with-param name="current-tab" select="()" />
                  <xsl:with-param name="current-content" select="()" />
                </xsl:next-iteration>
              </xsl:when>
              <xsl:otherwise>
                <xsl:next-iteration>
                  <xsl:with-param name="completed" select="$flushed?completed" />
                  <xsl:with-param name="current-type" select="$line-type" />
                  <xsl:with-param name="current-tab" select="$line-tab" />
                  <xsl:with-param name="current-content" select="$flushed?currentContent" />
                </xsl:next-iteration>
              </xsl:otherwise>
            </xsl:choose>
          </xsl:when>
          <xsl:otherwise>
            <xsl:variable name="merged" select="lb:merge-lines-into-state($completed, $current-type, $current-tab, $current-content, lb:normalize-node-to-lines(.))" />
            <xsl:next-iteration>
              <xsl:with-param name="completed" select="$merged?completed" />
              <xsl:with-param name="current-type" select="$merged?currentType" />
              <xsl:with-param name="current-tab" select="$merged?currentTab" />
              <xsl:with-param name="current-content" select="$merged?currentContent" />
            </xsl:next-iteration>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:iterate>
    </xsl:variable>
    <xsl:sequence select="$state?completed" />
  </xsl:function>

  <xsl:template match="text()">
    <xsl:value-of select="." />
  </xsl:template>

  <xsl:template match="t:page" mode="lb:classify-pages">
    <xsl:variable name="page" select="." />
    <xsl:variable name="line" select="ancestor::*[self::t:line or self::t:row][1]" />
    <!-- Text and empty editorial elements both count as content. -->
    <xsl:variable name="content" select="$line/descendant::node()[
      self::text()[normalize-space()]
      or self::lb:*[not(*) and not(self::lb:line or self::lb:vspace)
                    and not(text()[normalize-space()])]
    ]" />
    <xsl:copy>
      <xsl:copy-of select="@*" />
      <xsl:attribute name="break" select="
        if (exists($content[. &lt;&lt; $page]) and exists($content[. &gt;&gt; $page]))
        then 'inline' else 'block'" />
    </xsl:copy>
  </xsl:template>

  <xsl:template match="t:page">
    <xsl:param name="page-id-prefix" as="xs:string" select="'page-'" tunnel="yes" />
    <span class="page-anchor" id="{concat($page-id-prefix, @index)}"
          data-index="{@index}" data-break="{@break}"></span>
  </xsl:template>

  <xsl:template match="t:line[@type='vspace'] | t:row[@type='vspace']">
    <xsl:apply-templates />
  </xsl:template>

  <xsl:template match="lb:vspace">
    <xsl:variable name="lines" select="xs:positiveInteger(@lines)" />
    <div class="lb-vspace" data-lines="{$lines}" style="height: {$lines}lh" aria-hidden="true"></div>
  </xsl:template>

  <xsl:function name="lb:has-align" as="xs:boolean">
    <xsl:param name="nodes" as="node()*" />
    <xsl:sequence select="some $node in $nodes satisfies
      (if ($node/self::lb:align) then true()
       else if ($node/self::t:tabs or $node/self::lb:tab) then false()
       else lb:has-align($node/node()))" />
  </xsl:function>

  <xsl:template name="lb:render-regions">
    <xsl:param name="nodes" as="node()*" />
    <xsl:choose>
      <xsl:when test="lb:has-align($nodes)">
        <xsl:for-each select="('left', 'center', 'right')">
          <xsl:variable name="content" select="lb:filter-slot-nodes($nodes, ., ())" />
          <xsl:if test="exists($content[self::* or self::text()[normalize-space()]])">
            <div class="align-{.}"><xsl:apply-templates select="$content" /></div>
          </xsl:if>
        </xsl:for-each>
      </xsl:when>
      <xsl:otherwise><xsl:apply-templates select="$nodes" /></xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="t:line">
    <xsl:choose>
      <!-- Milestones between semantic blocks do not create blank lines. -->
      <xsl:when test="not(@type or @tab) and not(lb:has-meaningful-content(node()))">
        <xsl:apply-templates />
      </xsl:when>
      <xsl:otherwise>
        <div class="lb-line-block{if (@type = 'line') then ' lb-line-block--rule' else ''}">
          <xsl:if test="@tab"><xsl:attribute name="data-tab" select="@tab" /></xsl:if>
          <xsl:if test="lb:has-align(node())"><xsl:attribute name="data-layout">aligned</xsl:attribute></xsl:if>
          <xsl:choose>
            <xsl:when test="@type = 'line'">
              <xsl:apply-templates select="node()" />
              <hr class="lb-rule" />
            </xsl:when>
            <xsl:otherwise>
              <xsl:call-template name="lb:render-regions"><xsl:with-param name="nodes" select="node()" /></xsl:call-template>
            </xsl:otherwise>
          </xsl:choose>
        </div>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="t:tabs">
    <div class="tabs">
      <xsl:if test="@extent">
        <xsl:attribute name="data-extent" select="string(@extent)" />
      </xsl:if>
      <xsl:apply-templates />
    </div>
  </xsl:template>

  <xsl:template match="t:row">
    <div class="lb-tab-row">
      <xsl:if test="@tab">
        <xsl:attribute name="data-tab" select="string(@tab)" />
      </xsl:if>
      <xsl:choose>
        <xsl:when test="@type = 'line'">
          <xsl:apply-templates />
          <hr class="lb-rule" />
        </xsl:when>
        <xsl:otherwise>
          <xsl:apply-templates select="node()" />
        </xsl:otherwise>
      </xsl:choose>
    </div>
  </xsl:template>

  <!-- Notes are rendered separately by sidenotes.xsl. -->
  <xsl:template match="lb:sidenote" />

  <xsl:template match="lb:line">
    <xsl:sequence />
  </xsl:template>

  <xsl:template match="lb:align">
    <span class="align" data-pos="{@pos}">
      <xsl:apply-templates />
    </span>
  </xsl:template>

  <xsl:template match="lb:aq">
    <span class="aq"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:ul">
    <span class="ul"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:tul">
    <span class="tul"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:dul">
    <span class="dul"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:highlight">
    <mark class="highlight" data-color="{@color}">
      <xsl:apply-templates />
    </mark>
  </xsl:template>

  <xsl:template match="lb:undo">
    <span class="undo"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:address">
    <xsl:apply-templates />
  </xsl:template>

  <xsl:template match="lb:insertion">
    <span class="insertion">
      <xsl:if test="@pos">
        <xsl:attribute name="data-pos" select="@pos" />
      </xsl:if>
      <xsl:if test="@annotation">
        <xsl:attribute name="data-annotation" select="@annotation" />
      </xsl:if>
      <xsl:apply-templates />
    </span>
  </xsl:template>

  <xsl:template match="lb:del">
    <del><xsl:apply-templates /></del>
  </xsl:template>

  <xsl:template match="lb:hand">
    <span class="hand" data-ref="{@ref}"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:note">
    <span class="note"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:tl">
    <span class="tl"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:fn">
    <span class="fn" data-index="{@index}"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:pe">
    <span class="pe"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:anchor">
    <span class="anchor"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:nr">
    <span class="nr" data-extent="{if (@extent) then @extent else '1'}">
      <xsl:apply-templates select="node()[not(self::text()[not(normalize-space())])]" />
    </span>
  </xsl:template>

  <xsl:template match="lb:b">
    <strong><xsl:apply-templates /></strong>
  </xsl:template>

  <xsl:template match="lb:it">
    <em><xsl:apply-templates /></em>
  </xsl:template>

  <xsl:template match="lb:gr">
    <span class="gr"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:hb">
    <span class="hb"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:er">
    <span class="er"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:ink">
    <span class="ink"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:large">
    <span class="large"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:ru">
    <span class="ru"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:subst">
    <span class="subst"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:tabs">
    <xsl:apply-templates select="lb:normalize-tabs(.)" />
  </xsl:template>

  <xsl:template match="lb:tab">
    <div class="tab" data-value="{@value}">
      <xsl:call-template name="lb:render-regions"><xsl:with-param name="nodes" select="node()" /></xsl:call-template>
    </div>
  </xsl:template>

</xsl:stylesheet>
