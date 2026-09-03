# Employee Transportation Optimization — Problem Definition

## 1. Problem

Given a set of employees requiring transportation,
a set of available vehicles,
a company destination,
a vehicle depot,
road-network distances and travel times,
and transportation constraints,

generate a feasible transportation plan minimizing
the total travelled distance.

---

## 2. V1 Scope

The first version assumes:

- one company site
- one shift
- one common vehicle depot
- all employees are present in the optimization input
- employee home location is the pickup point
- identical vehicles
- known distance matrix
- known travel-time matrix
- no shared pickup stops
- no historical fairness
- no dynamic replanning
- no live traffic

---

## 3. Sets

E = set of employees

V = set of vehicles

N = set of routing nodes

N contains:

- depot
- employee pickup locations
- company destination

---

## 4. Parameters

Q_k:
capacity of vehicle k

q_i:
seat demand of employee i

d_ij:
road distance from node i to node j

t_ij:
travel time from node i to node j

T:
required company arrival deadline

M:
maximum employee commute time

---

## 5. Decision Variables

y_ik = 1 if employee i is assigned to vehicle k,
otherwise 0.

x_ijk = 1 if vehicle k travels directly
from node i to node j,
otherwise 0.

---

## 6. Hard Constraints

1. Every employee must be served exactly once.
2. Vehicle capacity must not be exceeded.
3. Routes must be continuous.
4. Vehicles start from the depot.
5. Vehicles end at the company.
6. The company arrival deadline must be respected.
7. Maximum passenger commute time must be respected.

---

## 7. Initial Objective

Minimize total travelled distance.

---

## 8. Output

For every vehicle:

- assigned employees
- route
- stop order
- pickup times
- company arrival time
- route distance

Overall KPIs:

- total distance
- average passenger commute
- maximum passenger commute
- vehicle occupancy
- number of vehicles used