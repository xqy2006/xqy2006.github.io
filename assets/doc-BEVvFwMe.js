var e={html:`<p>根据椭圆曲线加法原理，只要找到1组有理解后一直迭代即可</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">Python</span><span class="md-code-meta">33 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-Python"><span class="hljs-keyword">from</span> sage.<span class="hljs-built_in">all</span> <span class="hljs-keyword">import</span> *
<span class="hljs-keyword">from</span> fractions <span class="hljs-keyword">import</span> Fraction

<span class="hljs-keyword">def</span> <span class="hljs-title function_">multiply_list_values_1</span>(<span class="hljs-params">lst, number</span>):
    <span class="hljs-keyword">for</span> i <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-built_in">len</span>(lst)):
        lst[i] = lst[i] * number
    <span class="hljs-keyword">return</span> lst
R = RationalField()
n = <span class="hljs-number">6</span>

P2 = ProjectiveSpace(<span class="hljs-number">2</span>, R)
x, y, z = P2.coordinate_ring().gens()

E = EllipticCurve_from_cubic(x**<span class="hljs-number">3</span> - (n-<span class="hljs-number">1</span>)*x**<span class="hljs-number">2</span>*y - (n-<span class="hljs-number">1</span>)*x**<span class="hljs-number">2</span>*z - (n-<span class="hljs-number">1</span>)*x*y**<span class="hljs-number">2</span> - (<span class="hljs-number">2</span>*n-<span class="hljs-number">3</span>)*x*y*z - (n-<span class="hljs-number">1</span>)*x*z**<span class="hljs-number">2</span> + y**<span class="hljs-number">3</span> - (n-<span class="hljs-number">1</span>)*y**<span class="hljs-number">2</span>*z - (n-<span class="hljs-number">1</span>)*y*z**<span class="hljs-number">2</span> + z**<span class="hljs-number">3</span>)
<span class="hljs-comment">#print(E)</span>
g = E.inverse()
<span class="hljs-built_in">print</span>(E.codomain().integral_points(both_signs=<span class="hljs-literal">True</span>))
Pt = g(E.codomain().integral_points(both_signs=<span class="hljs-literal">True</span>)[<span class="hljs-number">0</span>])
<span class="hljs-keyword">for</span> n <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">1</span>, <span class="hljs-number">100000</span>):
    nPt_inE = E(Pt)*n
    nPt_inC = g(nPt_inE)
    <span class="hljs-comment">#print(nPt_inC)</span>
    X = nPt_inC[<span class="hljs-number">0</span>].numerator()
    Y = nPt_inC[<span class="hljs-number">1</span>].numerator()
    Z = nPt_inC[<span class="hljs-number">0</span>].denominator()
    <span class="hljs-keyword">if</span> X &gt; <span class="hljs-number">0</span> <span class="hljs-keyword">and</span> Y &gt; <span class="hljs-number">0</span>:
        <span class="hljs-built_in">print</span>(<span class="hljs-string">&quot;X =&quot;</span>, X)
        <span class="hljs-built_in">print</span>(<span class="hljs-string">&quot;Y =&quot;</span>, Y)
        <span class="hljs-built_in">print</span>(<span class="hljs-string">&quot;Z =&quot;</span>, Z)
        <span class="hljs-keyword">break</span>
problem = ((x/(y+z) + y/(x+z) + z/(x+y))-n)
<span class="hljs-keyword">if</span> problem(X, Y, Z) == <span class="hljs-number">0</span>:
    <span class="hljs-built_in">print</span>(<span class="hljs-string">&quot;OK!&quot;</span>)</code></pre></div>
`,toc:[]};export{e as default};