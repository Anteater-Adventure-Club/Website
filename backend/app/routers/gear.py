from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy import select
from ..auth import member, permission
from ..db import get_db
from .. import gear_schemas as s
from ..models import GearType, GearItem
from ..schemas import Items
from ..services import gear
from ..services import gear_custody as custody
from ..domain import require

router = APIRouter(prefix="/api")
database = Depends(get_db, scope="function")
officer = Depends(permission("gear"))


@router.get("/gear", response_model=s.GearCatalog)
def catalog(start: date, end: date, user=Depends(member), db=database):
    return gear.catalog(db, user.id, start, end)


@router.get("/me/gear-access", response_model=s.GearAccess)
def gear_access(user=Depends(member), db=database):
    return gear.member_access(db, user.id)


@router.get("/me/gear-rentals", response_model=Items[s.GearRentalView])
def own_rentals(user=Depends(member), db=database):
    return {"items": gear.rental_views(db, mid=user.id)}


@router.get("/me/gear-rentals/{rid}", response_model=s.GearRentalView)
def own_detail(rid: int, user=Depends(member), db=database):
    gear.rental_or_404(db, rid, user.id)
    return gear.rental_views(db, mid=user.id, rid=rid)[0]


@router.post("/me/gear-rentals", response_model=s.GearRentalView, status_code=201)
def request_rental(value: s.GearRequest, user=Depends(member), db=database):
    rental = gear.create(db, user, value)
    return gear.rental_views(db, rid=rental.id)[0]


@router.post("/me/gear-rentals/{rid}/cancel", response_model=s.GearRentalView)
def cancel(rid: int, value: s.GearSelection, user=Depends(member), db=database):
    gear.change(db, user, rid, value, own=True)
    return gear.rental_views(db, rid=rid)[0]


@router.get("/admin/gear/catalog", response_model=s.GearCatalog)
def member_catalog(member_id: int, start: date, end: date, user=officer, db=database):
    return gear.catalog(db, member_id, start, end)


@router.get("/admin/gear/inventory", response_model=s.GearInventory)
def inventory(user=officer, db=database):
    gear.lock_gear(db, shared=True)
    return {
        "types": list(db.scalars(select(GearType).order_by(GearType.name))),
        "items": list(db.scalars(select(GearItem).order_by(GearItem.name, GearItem.id))),
        "holders": custody.holders(db),
        "officers": custody.officers(db),
    }


@router.post("/admin/gear/types", response_model=s.GearTypeView, status_code=201)
def create_type(value: s.GearTypeWrite, user=officer, db=database):
    return gear.write_type(db, user, value)


@router.put("/admin/gear/inventory/{iid}/custody/{number}", response_model=s.GearItemView)
def transfer_custody(iid: int, number: int, value: s.GearCustodyEdit, user=officer, db=database):
    gear.lock_gear(db)
    item = require(db, GearItem, iid)
    custody.transfer(db, user, item, number, value)
    return item


@router.put("/admin/gear/types/{tid}", response_model=s.GearTypeView)
def update_type(tid: int, value: s.GearTypeEdit, user=officer, db=database):
    return gear.write_type(db, user, value, tid)


@router.post("/admin/gear/inventory", response_model=s.GearItemView, status_code=201)
def create_item(value: s.GearItemWrite, user=officer, db=database):
    return gear.write_item(db, user, value)


@router.put("/admin/gear/inventory/{iid}", response_model=s.GearItemView)
def update_item(iid: int, value: s.GearItemEdit, user=officer, db=database):
    return gear.write_item(db, user, value, iid)


@router.get("/admin/gear/rentals", response_model=Items[s.GearRentalView])
def rentals(user=officer, db=database):
    return {"items": gear.rental_views(db)}


@router.get("/admin/gear/rentals/{rid}", response_model=s.GearRentalView)
def detail(rid: int, user=officer, db=database):
    gear.rental_or_404(db, rid)
    return gear.rental_views(db, rid=rid)[0]


@router.post("/admin/gear/rentals", response_model=s.GearRentalView, status_code=201)
def assign(value: s.GearAssignment, user=officer, db=database):
    rental = gear.create(db, user, value, assigned=True)
    return gear.rental_views(db, rid=rental.id)[0]


@router.post("/admin/gear/rentals/{rid}/actions", response_model=s.GearRentalView)
def action(rid: int, value: s.GearAction, user=officer, db=database):
    gear.change(db, user, rid, value)
    return gear.rental_views(db, rid=rid)[0]


@router.put("/admin/gear/rentals/{rid}/dates", response_model=s.GearRentalView)
def dates(rid: int, value: s.GearReschedule, user=officer, db=database):
    gear.reschedule(db, user, rid, value)
    return gear.rental_views(db, rid=rid)[0]
