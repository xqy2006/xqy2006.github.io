---
title: 寻找a(b+c)+b(a+c)+c(a+b)=N正整数解
createTime: 2025/03/08 02:41:48
permalink: /article/edfngw96/
---

根据椭圆曲线加法原理，只要找到1组有理解后一直迭代即可

```Python
from sage.all import *
from fractions import Fraction

def multiply_list_values_1(lst, number):
    for i in range(len(lst)):
        lst[i] = lst[i] * number
    return lst
R = RationalField()
n = 6

P2 = ProjectiveSpace(2, R)
x, y, z = P2.coordinate_ring().gens()

E = EllipticCurve_from_cubic(x**3 - (n-1)*x**2*y - (n-1)*x**2*z - (n-1)*x*y**2 - (2*n-3)*x*y*z - (n-1)*x*z**2 + y**3 - (n-1)*y**2*z - (n-1)*y*z**2 + z**3)
#print(E)
g = E.inverse()
print(E.codomain().integral_points(both_signs=True))
Pt = g(E.codomain().integral_points(both_signs=True)[0])
for n in range(1, 100000):
    nPt_inE = E(Pt)*n
    nPt_inC = g(nPt_inE)
    #print(nPt_inC)
    X = nPt_inC[0].numerator()
    Y = nPt_inC[1].numerator()
    Z = nPt_inC[0].denominator()
    if X > 0 and Y > 0:
        print("X =", X)
        print("Y =", Y)
        print("Z =", Z)
        break
problem = ((x/(y+z) + y/(x+z) + z/(x+y))-n)
if problem(X, Y, Z) == 0:
    print("OK!")
```

